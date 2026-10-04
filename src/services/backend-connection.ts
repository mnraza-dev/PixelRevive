import { withRequestTimeout } from './abort';

export function resolveBackendUrl(configured?: string, production = false): string {
  if (!configured?.trim()) throw new Error('Set EXPO_PUBLIC_BACKEND_PROXY_URL to your backend address.');
  try {
    const url = new URL(configured.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid URL');
    }
    if (production && (url.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[|.*\.local$)/i.test(url.hostname))) throw new Error('Production requires a public HTTPS backend.');
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    if (error instanceof Error && error.message === 'Production requires a public HTTPS backend.') throw error;
    throw new Error('EXPO_PUBLIC_BACKEND_PROXY_URL must be a valid HTTP or HTTPS URL.');
  }
}

export function connectionError(error: unknown, base: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/cleartext.*(not permitted|denied)|CLEARTEXT communication/i.test(message)) {
    return new Error(`Android blocked HTTP access to ${base}. Use an HTTPS backend, or a development build that allows local HTTP.`);
  }
  if (/network request failed|failed to fetch|fetch failed|java\.net|connectexception|econnrefused|unable to resolve host|connection refused|request timed out/i.test(message)) {
    if (base.startsWith('https://')) return new Error('Cannot connect to the photo service. Check your internet connection and try again shortly.');
    return new Error(`Cannot connect to the image backend at ${base}. Keep the backend running (bun run backend), connect the phone and computer to the same Wi-Fi, and use the computer's LAN IP instead of localhost. Check firewall or VPN settings if it still fails.`);
  }
  return error instanceof Error ? error : new Error(message || 'Image processing failed. Please try again.');
}

export async function readBackendResponse(response: Response) {
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`The backend returned an invalid response (HTTP ${response.status}). Check that the configured URL points to the image backend.`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The backend returned an invalid response.');
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Backend request failed (HTTP ${response.status}).`);
  return data;
}

export async function checkBackendConnection(base: string, parent?: AbortSignal, expectedProvider?: string, image?: { width: number; height: number; scale?: number }) {
  try {
    await withRequestTimeout(async (signal) => {
      const response = await fetch(`${base}/health`, { signal });
      const health = await readBackendResponse(response);
      if (expectedProvider && health.provider !== expectedProvider) throw new Error('The photo service configuration has changed. Update the app before uploading a photo.');
      if (health.ok !== true || !Array.isArray(health.modes)) throw new Error('This server is not the image-processing backend. Check EXPO_PUBLIC_BACKEND_PROXY_URL.');
      if (image && Number.isInteger(health.limits?.maxInputPixels) && image.width * image.height > health.limits.maxInputPixels) throw new Error(`Choose a smaller photo, up to ${health.limits.maxInputPixels / 1000000} megapixels for this studio.`);
      if (image && Number.isInteger(health.limits?.maxOutputPixels) && image.width * image.height * (image.scale || 1) ** 2 > health.limits.maxOutputPixels) throw new Error('The enlarged photo would exceed the studio’s image limit. Choose a smaller photo or lower upscale size.');
    }, 10000, parent);
  } catch (error) { throw connectionError(error, base); }
}
