import { test, expect, spyOn } from 'bun:test';
import { resolveBackendUrl, connectionError, readBackendResponse, checkBackendConnection } from '../src/services/backend-connection';

test('backend URL validation catches missing and malformed addresses', () => {
  expect(() => resolveBackendUrl()).toThrow('Set EXPO_PUBLIC');
  expect(() => resolveBackendUrl('192.168.1.39:3001')).toThrow('valid HTTP');
  expect(() => resolveBackendUrl('ftp://example.com')).toThrow('valid HTTP');
  expect(() => resolveBackendUrl('http://user:password@example.com')).toThrow('valid HTTP');
  expect(resolveBackendUrl(' http://192.168.1.39:3001/ ')).toBe('http://192.168.1.39:3001');
});
test('Java connection failures explain which server is unreachable', () => {
  const error = connectionError(new Error('java.net.ConnectException: failed to connect'), 'http://192.168.1.39:3001');
  expect(error.message).toContain('192.168.1.39:3001');
  expect(error.message).toContain('same Wi-Fi');
  expect(error.message).toContain('instead of localhost');
  expect(connectionError(new Error('CLEARTEXT communication not permitted'), 'http://local:3001').message).toContain('Android blocked HTTP');
});
test('cancellation and server errors retain their meaning', () => {
  const canceled = new Error('Processing canceled.'); canceled.name = 'AbortError';
  expect(connectionError(canceled, 'http://local')).toBe(canceled);
  const quota = new Error('Daily free limit reached.');
  expect(connectionError(quota, 'http://local')).toBe(quota);
});
test('unexpected HTML and missing error fields produce useful messages', async () => {
  await expect(readBackendResponse(new Response('<html>wrong server</html>', { status: 200 }))).rejects.toThrow('invalid response');
  await expect(readBackendResponse(Response.json({}, { status: 500 }))).rejects.toThrow('HTTP 500');
  await expect(readBackendResponse(Response.json({ error: 'Daily free limit reached.' }, { status: 429 }))).rejects.toThrow('Daily free limit');
});
test('health check distinguishes a working backend from a connection failure', async () => {
  const mock = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true, modes: ['auto'] }));
  try {
    await expect(checkBackendConnection('http://192.168.1.39:3001')).resolves.toBeUndefined();
    expect(mock.mock.calls[0][0]).toBe('http://192.168.1.39:3001/health');
    mock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(checkBackendConnection('http://192.168.1.39:3001')).rejects.toThrow('Cannot connect');
  } finally { mock.mockRestore(); }
});

test('release runtime refuses HTTP/LAN backends and uses consumer connection messages', () => {
  expect(() => resolveBackendUrl('http://192.168.1.39:3001', true)).toThrow('public HTTPS');
  expect(() => resolveBackendUrl('https://127.0.0.1', true)).toThrow('public HTTPS');
  expect(resolveBackendUrl('https://api.pixelrevive.app', true)).toBe('https://api.pixelrevive.app');
  expect(connectionError(new Error('Network request failed'), 'https://api.pixelrevive.app').message).toContain('internet connection');
});
test('a changed external processing provider blocks upload before consent is invalidated', async () => {
  const mock = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true, provider: 'replicate', modes: ['auto'] }));
  try { await expect(checkBackendConnection('https://api.pixelrevive.app', undefined, 'local')).rejects.toThrow('configuration has changed'); }
  finally { mock.mockRestore(); }
});

test('MVP pixel limits reject oversized inputs and upscales before image upload', async () => {
  const mock = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ ok: true, provider: 'local', modes: ['auto'], limits: { maxInputPixels: 4000000, maxOutputPixels: 16000000 } }));
  try {
    await expect(checkBackendConnection('https://api.pixelrevive.app', undefined, 'local', { width: 4000, height: 3000 })).rejects.toThrow('4 megapixels');
    await expect(checkBackendConnection('https://api.pixelrevive.app', undefined, 'local', { width: 2000, height: 1500, scale: 4 })).rejects.toThrow('lower upscale size');
    await expect(checkBackendConnection('https://api.pixelrevive.app', undefined, 'local', { width: 2000, height: 1500, scale: 2 })).resolves.toBeUndefined();
  } finally { mock.mockRestore(); }
});
