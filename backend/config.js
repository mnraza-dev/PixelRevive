import { isIP } from 'node:net';
import { createHmac } from 'node:crypto';

function integer(value, fallback, name, min, max) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return parsed;
}
export function serverConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const provider = env.BACKEND_PROVIDER || 'local';
  if (!['local', 'replicate'].includes(provider)) throw new Error('BACKEND_PROVIDER must be local or replicate.');
  if (provider === 'replicate' && !env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN is required.');
  if (production && (!env.QUOTA_SECRET || env.QUOTA_SECRET.length < 32)) throw new Error('Set a persistent server-only QUOTA_SECRET of at least 32 characters.');
  if (production && provider === 'replicate') {
    for (const mode of ['AUTO', 'FACE_ENHANCE', 'PHOTO_RESTORE', 'HD_UPSCALE', 'SHARPEN', 'REMOVE_BG']) {
      if (!/^[a-f0-9]{64}$/.test(env[`REPLICATE_VERSION_${mode}`] || '')) throw new Error(`Pin REPLICATE_VERSION_${mode} to a full model version hash for production.`);
    }
  }
  const origins = (env.ALLOWED_ORIGINS || (production ? '' : 'http://localhost:8081,http://localhost:19006')).split(',').map(v => v.trim()).filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || (production && url.protocol !== 'https:')) throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins in production.');
  }
  if (env.TRUST_RAILWAY_PROXY && !['true', 'false'].includes(env.TRUST_RAILWAY_PROXY)) throw new Error('TRUST_RAILWAY_PROXY must be true or false.');
  const trustRailwayProxy = env.TRUST_RAILWAY_PROXY === 'true';
  if (trustRailwayProxy && (!env.RAILWAY_SERVICE_ID || !env.RAILWAY_ENVIRONMENT_ID)) throw new Error('Railway proxy trust is only supported inside a Railway service.');
  const trustedProxies = (env.TRUSTED_PROXY_IPS || '').split(',').map(v => v.trim()).filter(Boolean);
  if (trustedProxies.some(ip => !isIP(ip))) throw new Error('TRUSTED_PROXY_IPS must contain exact IP addresses, never a wildcard.');
  return {
    production, provider, origins, trustedProxies, trustRailwayProxy, secret: env.QUOTA_SECRET || 'local-development-quota-key',
    dailyLimit: integer(env.DAILY_FREE_LIMIT, 3, 'DAILY_FREE_LIMIT', 1, 1000),
    globalLimit: integer(env.GLOBAL_DAILY_LIMIT, 100, 'GLOBAL_DAILY_LIMIT', 1, 100000),
    concurrency: integer(env.MAX_CONCURRENT_JOBS, 2, 'MAX_CONCURRENT_JOBS', 1, 8),
    inputPixels: integer(env.MAX_INPUT_PIXELS, 20000000, 'MAX_INPUT_PIXELS', 100000, 20000000),
    outputPixels: integer(env.MAX_OUTPUT_PIXELS, 40000000, 'MAX_OUTPUT_PIXELS', 100000, 40000000),
    ttl: integer(env.RESULT_TTL_HOURS, 24, 'RESULT_TTL_HOURS', 1, 48) * 3600000,
  };
}
export function quotaSubject(peer, forwarded, config, railwayClientIp) {
  let ip = peer;
  // Only the explicitly trusted proxy's LAST forwarded hop is trusted. It must append or overwrite this header.
  if (config.trustRailwayProxy) {
    // Only enable with Railway HTTPS ingress; never expose a TCP proxy or untrusted private callers.
    if (!isIP(railwayClientIp || '')) throw new Error('Missing or invalid Railway client address.');
    ip = railwayClientIp;
  } else if (config.trustedProxies.includes(peer) && forwarded) {
    const candidate = forwarded.split(',').at(-1).trim();
    if (!isIP(candidate)) throw new Error('Invalid forwarded client address.');
    ip = candidate;
  }
  if (!ip || !isIP(ip)) throw new Error('Could not determine client address.');
  // Group IPv6 addresses by /64 so privacy address rotation cannot cheaply reset quotas.
  if (isIP(ip) === 6 && !ip.startsWith('::ffff:')) {
    const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const [left, right = ''] = normalized.split('::');
    const head = left ? left.split(':') : []; const tail = right ? right.split(':') : [];
    const parts = normalized.includes('::') ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail] : head;
    ip = `${parts.slice(0, 4).map(v => v.padStart(4, '0')).join(':')}::/64`;
  }
  return createHmac('sha256', config.secret).update(ip).digest('hex');
}
