import { test, expect } from 'bun:test';
import { refillDailyCredits } from '../src/services/credits';
import { serverConfig, quotaSubject } from '../backend/config';
import { createStore, tokenHash } from '../backend/store';
import { validateReleaseConfig } from '../scripts/release-config.cjs';

const guest = { id: 'guest', creditsRemaining: 1, lastCreditRefillDate: '2026-10-03', isGuest: true };
test('credits never refill twice in one UTC day, including migrated guests', () => {
  expect(refillDailyCredits(guest, '2026-10-03').creditsRemaining).toBe(1);
  expect(refillDailyCredits(guest, '2026-10-04').creditsRemaining).toBe(3);
  expect(refillDailyCredits({ ...guest, lastCreditRefillDate: undefined }, '2026-10-03').creditsRemaining).toBe(1);
});
test('release build rejects demo mode, LAN endpoints and missing public policy URLs', () => {
  const env = { EXPO_PUBLIC_AI_PROVIDER: 'backend', EXPO_PUBLIC_PROCESSING_PROVIDER: 'local', EXPO_PUBLIC_BACKEND_PROXY_URL: 'https://api.pixelrevive.app', EXPO_PUBLIC_PRIVACY_URL: 'https://pixelrevive.app/privacy', EXPO_PUBLIC_SUPPORT_URL: 'https://pixelrevive.app/support' };
  expect(() => validateReleaseConfig(env)).not.toThrow();
  for (const url of ['http://api.pixelrevive.app', 'https://192.168.1.2', 'https://api.example.com', 'https://local.test']) expect(() => validateReleaseConfig({ ...env, EXPO_PUBLIC_BACKEND_PROXY_URL: url })).toThrow();
  expect(() => validateReleaseConfig({ ...env, EXPO_PUBLIC_AI_PROVIDER: 'mock' })).toThrow();
  expect(() => validateReleaseConfig({ ...env, EXPO_PUBLIC_PRIVACY_URL: '' })).toThrow();
});
test('production requires a quota secret and explicit safe origins', () => {
  expect(() => serverConfig({ NODE_ENV: 'production' })).toThrow('QUOTA_SECRET');
  expect(() => serverConfig({ DAILY_FREE_LIMIT: 'NaN' })).toThrow();
  expect(() => serverConfig({ TRUSTED_PROXY_IPS: '*' })).toThrow();
  expect(() => serverConfig({ NODE_ENV: 'production', QUOTA_SECRET: 'x'.repeat(32), ALLOWED_ORIGINS: 'http://example.com' })).toThrow();
});
test('untrusted forwarded IPs cannot evade quotas; trusted last hop and IPv6 /64 are normalized', () => {
  const config = serverConfig({ TRUSTED_PROXY_IPS: '127.0.0.1' });
  expect(quotaSubject('192.168.1.5', '8.8.8.8', config)).toBe(quotaSubject('192.168.1.5', null, config));
  expect(quotaSubject('127.0.0.1', '1.1.1.1, 8.8.8.8', config)).toBe(quotaSubject('8.8.8.8', null, config));
  expect(quotaSubject('2001:db8:1234:5678::1', null, config)).toBe(quotaSubject('2001:db8:1234:5678:aaaa::2', null, config));
});
test('interrupted jobs recover with exactly one quota refund; global budget is atomic', () => {
  const store = createStore(':memory:'); const day = '2026-10-03';
  const job = { id: 'one', tokenHash: tokenHash('a'.repeat(64)), createdAt: Date.now(), status: 'processing' };
  try {
    expect(store.reserve(job, 'user', day, 3, 1)).toBe(true);
    expect(store.reserve({ ...job, id: 'two' }, 'another', day, 3, 1)).toBe(false);
    store.recover(); store.refund('one');
    expect(store.get('one').status).toBe('failed'); expect(store.remaining('user', day, 3)).toBe(3);
    expect(store.reserve({ ...job, id: 'three' }, 'another', day, 3, 1)).toBe(false);
    expect(store.reserve({ ...job, id: 'three' }, 'another', day, 3, 2)).toBe(true);
  } finally { store.close(); }
});

test('Railway ingress trust is opt-in and uses its client header instead of the shared proxy address', () => {
  const direct = serverConfig({});
  expect(quotaSubject('10.0.0.2', null, direct, '8.8.8.8')).toBe(quotaSubject('10.0.0.2', null, direct));
  expect(() => serverConfig({ TRUST_RAILWAY_PROXY: 'true' })).toThrow('Railway service');
  const railway = serverConfig({ TRUST_RAILWAY_PROXY: 'true', RAILWAY_SERVICE_ID: 'service', RAILWAY_ENVIRONMENT_ID: 'environment' });
  expect(quotaSubject('10.0.0.2', '1.1.1.1', railway, '8.8.8.8')).toBe(quotaSubject('8.8.8.8', null, direct));
  expect(() => quotaSubject('10.0.0.2', null, railway, 'not-an-ip')).toThrow();
  expect(() => quotaSubject('10.0.0.2', null, railway)).toThrow();
});
test('MVP image pixel limits remain bounded by the default processing ceiling', () => {
  const config = serverConfig({ MAX_INPUT_PIXELS: '4000000', MAX_OUTPUT_PIXELS: '16000000', MAX_CONCURRENT_JOBS: '1' });
  expect(config.inputPixels).toBe(4000000); expect(config.outputPixels).toBe(16000000); expect(config.concurrency).toBe(1);
  expect(() => serverConfig({ MAX_INPUT_PIXELS: 'Infinity' })).toThrow();
  expect(() => serverConfig({ MAX_OUTPUT_PIXELS: '40000001' })).toThrow();
});
