const { isIP } = require('node:net');
function publicHttps(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be configured with a public HTTPS URL.`); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || isIP(host) || host.startsWith('[') || !host.includes('.') || /(^|\.)(localhost|local|internal|example\.com|example\.org|example\.net)$/.test(host) || host.endsWith('.test') || host.endsWith('.invalid')) throw new Error(`${name} must be a real public HTTPS URL, without credentials or placeholders.`);
  return url;
}
function validateReleaseConfig(env = process.env) {
  if (env.EXPO_PUBLIC_AI_PROVIDER !== 'backend') throw new Error('Release builds require EXPO_PUBLIC_AI_PROVIDER=backend.');
  if (!['local', 'replicate'].includes(env.EXPO_PUBLIC_PROCESSING_PROVIDER)) throw new Error('Set EXPO_PUBLIC_PROCESSING_PROVIDER=local or replicate to match the server and upload consent.');
  const api = publicHttps(env.EXPO_PUBLIC_BACKEND_PROXY_URL, 'EXPO_PUBLIC_BACKEND_PROXY_URL');
  if (api.search) throw new Error('The backend URL must not include query parameters.');
  for (const name of ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_SUPPORT_URL']) publicHttps(env[name], name);
}
module.exports = { validateReleaseConfig };
if (require.main === module) { validateReleaseConfig(); console.log('Release environment is valid.'); }
