// Bun-native backend: private jobs, bounded uploads, cancellation and quotas.
import { mkdir, readdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createStore, tokenHash, authorized } from './store.js';
import { serverConfig, quotaSubject } from './config.js';
const root = dirname(fileURLToPath(import.meta.url));
const defaultDataDir = resolve(process.env.DATA_DIR || resolve(root, 'data'));
const python = process.env.PYTHON_BIN || resolve(root, '.venv/bin/python');
const modes = ['auto', 'face_enhance', 'photo_restore', 'hd_upscale', 'sharpen', 'color_enhance', 'remove_bg'];
const defaults = { scale: 2, strength: 80, faceEnhanceStrength: 85, sharpening: 70, noiseReduction: 60, colorEnhancement: 75, preset: 'balanced' };
const stages = ['Validating image...', 'Processing image...', 'Saving result...'];
export function validateSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !modes.includes(value.mode)) throw new Error('Choose a supported mode.');
  const settings = { ...defaults, ...value };
  if (![2, 4].includes(settings.scale)) throw new Error('Scale must be 2 or 4.');
  for (const key of ['strength', 'faceEnhanceStrength', 'sharpening', 'noiseReduction', 'colorEnhancement']) {
    if (!Number.isFinite(settings[key]) || settings[key] < 0 || settings[key] > 100) throw new Error(`${key} must be between 0 and 100.`);
  }
  if (!['natural', 'balanced', 'strong', 'old_photo', 'portrait', 'custom'].includes(settings.preset)) throw new Error('Choose a supported preset.');
  return Object.fromEntries(['mode', ...Object.keys(defaults)].map(key => [key, settings[key]]));
}
function worker(input, output, settings, signal) {
  return new Promise((accept, reject) => {
    const child = spawn(python, [resolve(root, 'worker.py'), input, output, JSON.stringify(settings)], {
      signal, env: { ...process.env, U2NET_HOME: process.env.U2NET_HOME || resolve(root, 'models'), NUMBA_CACHE_DIR: process.env.NUMBA_CACHE_DIR || resolve(defaultDataDir, 'numba'), OMP_NUM_THREADS: '2' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    let spawnError; let killTimer;
    const forceKill = () => { if (!killTimer) { killTimer = setTimeout(() => child.kill('SIGKILL'), 5000); killTimer.unref(); } };
    signal?.addEventListener('abort', forceKill, { once: true });
    child.on('error', error => { spawnError = error; if (error.name === 'AbortError') forceKill(); else reject(error); });
    child.on('close', code => {
      clearTimeout(killTimer); signal?.removeEventListener('abort', forceKill);
      if (spawnError) return reject(spawnError);
      if (code !== 0) return reject(new Error(stderr.trim().split('\n').pop() || 'Image processing failed.'));
      try { accept(JSON.parse(stdout)); } catch { reject(new Error('Invalid processing response.')); }
    });
  });
}
async function replicate(inputPath, outputPath, settings, job, persist) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('Set REPLICATE_API_TOKEN on the backend for neural processing.');
  const request = async (path, options = {}) => {
    const response = await fetch(`https://api.replicate.com/v1/${path}`, {
      ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.any([job.controller.signal, AbortSignal.timeout(30000)]),
    });
    if (!response.ok) throw new Error(`AI provider request failed (${response.status}). Check server credentials, billing and models.`);
    return response.json();
  };
  const restore = ['face_enhance', 'photo_restore'].includes(settings.mode);
  const model = settings.mode === 'remove_bg' ? 'cjwbw/rembg' : restore ? 'tencentarc/gfpgan' : 'nightmareai/real-esrgan';
  const pin = process.env[`REPLICATE_VERSION_${settings.mode.toUpperCase()}`];
  const version = pin ? await request(`models/${model}/versions/${pin}`) : (await request(`models/${model}`)).latest_version;
  if (!version?.id) throw new Error('No available model version.');
  const props = version.openapi_schema?.components?.schemas?.Input?.properties || {};
  const input = { [props.img ? 'img' : 'image']: `data:${job.mimeType};base64,${Buffer.from(await Bun.file(inputPath).arrayBuffer()).toString('base64')}` };
  if (props.scale) input.scale = settings.scale;
  if (props.upscale) input.upscale = settings.scale;
  if (props.face_enhance) input.face_enhance = settings.mode === 'auto';
  let prediction = await request('predictions', { method: 'POST', headers: { 'Cancel-After': '4m' }, body: JSON.stringify({ version: version.id, input }) });
  job.predictionId = prediction.id; persist(job);
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    await new Promise(r => setTimeout(r, 2000));
    job.controller.signal.throwIfAborted();
    prediction = await request(`predictions/${prediction.id}`);
  }
  if (prediction.status !== 'succeeded') throw new Error('AI processing failed. Try a different photo.');
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof output !== 'string') throw new Error('AI provider returned no image.');
  const outputUrl = new URL(output);
  if (outputUrl.protocol !== 'https:' || !(outputUrl.hostname === 'replicate.delivery' || outputUrl.hostname.endsWith('.replicate.delivery'))) throw new Error('AI provider returned an unsupported image host.');
  const response = await fetch(output, { redirect: 'error', signal: AbortSignal.any([job.controller.signal, AbortSignal.timeout(30000)]) });
  if (!response.ok) throw new Error('Could not download processed image.');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 100 * 1024 * 1024) { job.controller.abort(); throw new Error('Output image too large.'); }
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const downloaded = `${outputPath}.download`;
  try {
    await Bun.write(downloaded, bytes);
    return await worker(downloaded, outputPath, { ...settings, mode: 'normalize' }, job.controller.signal);
  } finally { await rm(downloaded, { force: true }); }
}
export async function createServer({ port = Number(process.env.PORT || 3001), processor, dailyLimit, dataDirectory = defaultDataDir, config = serverConfig() } = {}) {
  dailyLimit ??= config.dailyLimit;
  const dataDir = resolve(dataDirectory);
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const store = createStore(resolve(dataDir, 'jobs.sqlite'));
  store.recover();
  // A restart must not leave interrupted original uploads on disk.
  for (const name of await readdir(dataDir)) if (/^[a-f0-9-]{36}\.(input|input\.sanitized|png\.download)$/.test(name)) await rm(resolve(dataDir, name), { force: true });
  const running = new Map(); const tasks = new Set(); let active = 0; let stopping = false;
  const cleanup = async () => {
    for (const id of store.expired(Date.now() - config.ttl)) {
      if (running.has(id)) continue;
      for (const suffix of ['input', 'input.sanitized', 'png', 'png.download']) await rm(resolve(dataDir, `${id}.${suffix}`), { force: true });
      store.delete(id);
    }
    // Covers files written immediately before a process crash, or by older server versions.
    for (const name of await readdir(dataDir)) {
      if (!/^[a-f0-9-]{36}\.(input|input\.sanitized|png|png\.download)$/.test(name) || running.has(name.slice(0, 36))) continue;
      const file = Bun.file(resolve(dataDir, name));
      if ((await file.stat()).mtimeMs < Date.now() - config.ttl) await rm(file.name, { force: true });
    }
    store.cleanupUsage(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10));
  };
  await cleanup();
  let cleaning = false; let cleanupTask = Promise.resolve();
  const cleanupTimer = setInterval(() => {
    if (cleaning || stopping) return;
    cleaning = true;
    cleanupTask = cleanup().catch(() => console.error('Result cleanup failed. Check storage permissions.')).finally(() => { cleaning = false; });
  }, 60000);
  cleanupTimer.unref();
  const save = job => store.save(job);
  const server = Bun.serve({ port, hostname: process.env.HOST || '0.0.0.0', maxRequestBodySize: 16 * 1024 * 1024, idleTimeout: 60,
    async fetch(req, instance) {
      const url = new URL(req.url); const origin = req.headers.get('origin');
      const headers = { 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
      if (origin && config.origins.includes(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
      const json = (body, status = 200, extraHeaders = {}) => Response.json(body, { status, headers: { ...headers, ...extraHeaders } });
      if (origin && !config.origins.includes(origin)) return json({ error: 'Origin not allowed.' }, 403);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (url.pathname === '/health' && req.method === 'GET') return json({ ok: true, provider: config.provider, modes, dailyFreeLimit: dailyLimit, limits: { maxInputPixels: config.inputPixels, maxOutputPixels: config.outputPixels } });
      if (url.pathname === '/ready' && req.method === 'GET') return json({ ok: !stopping }, stopping ? 503 : 200);
      if (stopping) return json({ error: 'Server restarting. Try again shortly.' }, 503, { 'Retry-After': '10' });
      const match = url.pathname.match(/^\/jobs\/([a-f0-9-]{36})(\/result)?$/);
      if (match) {
        const job = running.get(match[1]) || store.get(match[1]);
        const token = req.headers.get('authorization')?.replace(/^Bearer /, '') || (match[2] ? url.searchParams.get('token') : null);
        if (!job || Date.now() - job.createdAt > config.ttl || !authorized(token, job.tokenHash)) return json({ error: 'Job not found or expired.' }, 404);
        if (req.method === 'DELETE' && !match[2]) {
          if (['queued', 'processing'].includes(job.status)) { job.status = 'canceled'; job.controller.abort(); save(job); }
          else { await rm(job.output, { force: true }); store.delete(job.id); }
          return json({ status: 'canceled' });
        }
        if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
        if (match[2]) {
          if (job.status !== 'completed') return json({ error: 'Result not ready.' }, 409);
          const file = Bun.file(job.output);
          if (!(await file.exists())) return json({ error: 'Result not found or expired.' }, 404);
          return new Response(file, { headers: { ...headers, 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="enhanced.png"' } });
        }
        const result = job.result ? { ...job.result, resultPath: `/jobs/${job.id}/result?token=${token}` } : undefined;
        return json({ id: job.id, status: job.status, progress: job.progress, stage: job.stage, stages, provider: job.provider, error: job.error, result });
      }
      if (url.pathname !== '/jobs' || req.method !== 'POST') return json({ error: 'Not found.' }, 404);
      if (active >= config.concurrency) return json({ error: 'Processing busy. Try again shortly.' }, 429, { 'Retry-After': '10' });
      let subject;
      try { subject = quotaSubject(instance.requestIP(req)?.address, req.headers.get('x-forwarded-for'), config, req.headers.get('x-real-ip')); }
      catch { return json({ error: 'Could not determine client address.' }, 400); }
      const day = new Date().toISOString().slice(0, 10);
      if (!store.remaining(subject, day, dailyLimit)) return json({ error: 'Daily free limit reached. Try again tomorrow.' }, 429);
      if (Number(req.headers.get('content-length')) > 16 * 1024 * 1024) return json({ error: 'Upload an image up to 15 MB.' }, 413);
      let form; let settings;
      try { form = await req.formData(); settings = validateSettings(JSON.parse(String(form.get('settings')))); }
      catch { return json({ error: 'Invalid image upload or settings.' }, 400); }
      if (form.get('processingProvider') !== config.provider) return json({ error: 'Processing provider changed. Update the app and confirm upload permission again.' }, 409);
      const image = form.get('image');
      if (!(image instanceof File) || !image.size || image.size > 15 * 1024 * 1024) return json({ error: 'Upload an image up to 15 MB.' }, 400);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) return json({ error: 'Choose JPEG, PNG or WebP.' }, 415);
      if (active >= config.concurrency) return json({ error: 'Processing busy. Try again shortly.' }, 429, { 'Retry-After': '10' });
      const id = crypto.randomUUID(); const token = randomBytes(32).toString('hex');
      const input = resolve(dataDir, `${id}.input`); const sanitized = resolve(dataDir, `${id}.input.sanitized`); const output = resolve(dataDir, `${id}.png`);
      const neural = config.provider === 'replicate' && settings.mode !== 'color_enhance';
      const job = { id, output, tokenHash: tokenHash(token), mimeType: image.type, createdAt: Date.now(), status: 'queued', progress: 5, stage: stages[0], provider: neural ? 'Replicate neural processing' : 'Self-hosted image processing', controller: new AbortController() };
      if (!store.reserve(job, subject, day, dailyLimit, config.globalLimit)) return json({ error: 'Daily processing limit reached. Try again tomorrow.' }, 429);
      active++; running.set(id, job);
      const timer = setTimeout(() => { job.error = 'Processing timed out. Try a smaller image.'; job.controller.abort(); }, 300000);
      const task = (async () => {
        try {
          await Bun.write(input, image); job.controller.signal.throwIfAborted();
          job.status = 'processing'; job.progress = 25; job.stage = stages[1]; save(job);
          // Verify the decoded image before sending it to any billed external model.
          if (neural && !processor) { await worker(input, sanitized, { ...settings, mode: 'sanitize' }, job.controller.signal); job.mimeType = 'image/png'; }
          const metadata = processor ? await processor(input, output, settings, job) : neural ? await replicate(sanitized, output, settings, job, save) : await worker(input, output, settings, job.controller.signal);
          job.controller.signal.throwIfAborted();
          job.result = { ...metadata, processingTimeMs: Date.now() - job.createdAt, createdAt: Date.now(), isDemoResult: false };
          job.status = 'completed'; job.progress = 100; job.stage = stages[2]; save(job);
          if (config.production) console.log(JSON.stringify({ event: 'job_completed', mode: settings.mode, provider: config.provider, durationMs: Date.now() - job.createdAt }));
        } catch (err) {
          if (job.status !== 'canceled') { job.status = 'failed'; job.error = job.error || (config.production ? 'Could not process this photo. Try a smaller JPEG or PNG.' : err.message) || 'Processing failed.'; }
          if (config.production) console.error(JSON.stringify({ event: job.status === 'canceled' ? 'job_canceled' : 'job_failed', mode: settings.mode, provider: config.provider, durationMs: Date.now() - job.createdAt, errorType: err.name || 'Error' }));
          save(job); store.refund(id); await rm(output, { force: true });
        } finally {
          clearTimeout(timer); active--; await rm(input, { force: true }); await rm(sanitized, { force: true });
          if (job.predictionId && job.status !== 'completed') await fetch(`https://api.replicate.com/v1/predictions/${job.predictionId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` }, signal: AbortSignal.timeout(10000) }).catch(() => {});
          running.delete(id);
        }
      })();
      tasks.add(task);
      task.catch(() => console.error('Job cleanup failed. Check storage permissions.')).finally(() => tasks.delete(task));
      return json({ id, token, status: 'queued', stages, creditsRemaining: store.remaining(subject, day, dailyLimit) }, 202);
    },
    error() { console.error('request_failed'); return Response.json({ error: 'The photo service encountered an error. Try again shortly.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } }); },
  });
  return { server, cleanup, async stop() {
    stopping = true; clearInterval(cleanupTimer); for (const job of running.values()) job.controller.abort();
    server.stop(true); await Promise.allSettled([...tasks, cleanupTask]); store.close();
  } };
}
if (import.meta.main) {
  const config = serverConfig();
  // Fail before accepting requests when the image runtime/model is missing.
  if (config.production) {
    const check = Bun.spawn([python, '-c', 'import PIL, cv2, rembg; from pathlib import Path; import os; assert Path(os.environ["U2NET_HOME"], "u2netp.onnx").is_file(), "Missing background removal model"'], { env: { ...process.env, U2NET_HOME: process.env.U2NET_HOME || resolve(root, 'models') }, stdout: 'ignore', stderr: 'inherit' });
    if (await check.exited !== 0) throw new Error('Image runtime not ready. Install dependencies and pre-download u2netp.');
  }
  const app = await createServer({ config });
  console.log(`PixelRevive backend listening on ${app.server.url}`);
  let closing = false;
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { if (closing) return; closing = true; await app.stop(); process.exit(0); });
}
