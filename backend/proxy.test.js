import { test, expect } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as startServer, validateSettings } from './proxy.js';

async function createServer(options = {}) {
  const dataDirectory = options.dataDirectory || await mkdtemp(join(tmpdir(), 'pixelrevive-test-'));
  const instance = await startServer({ ...options, dataDirectory });
  return { ...instance, dataDirectory, async stop() { await instance.stop(); if (!options.dataDirectory) await rm(dataDirectory, { recursive: true, force: true }); } };
}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
function upload(mode = 'sharpen', image = new File([png], 'photo.png', { type: 'image/png' })) {
  const form = new FormData(); form.append('processingProvider', 'local'); form.append('image', image); form.append('settings', JSON.stringify({ mode, scale: 2 })); return form;
}
async function poll(url, id, token) {
  for (let i = 0; i < 1500; i++) {
    const state = await (await fetch(`${url}/jobs/${id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    if (['completed', 'failed', 'canceled'].includes(state.status)) return state;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error('Job did not finish');
}
test('settings reject unknown modes, unsupported scales and invalid strengths', () => {
  expect(() => validateSettings({ mode: 'unknown' })).toThrow();
  expect(() => validateSettings({ mode: 'auto', scale: 8 })).toThrow();
  expect(() => validateSettings({ mode: 'auto', sharpening: '70' })).toThrow();
  expect(() => validateSettings({ mode: 'auto', strength: 101 })).toThrow();
  expect(validateSettings({ mode: 'remove_bg' }).scale).toBe(2);
});
test('upload validation, jobs, private PNG output, and server daily quota', async () => {
  const instance = await createServer({ port: 0, dailyLimit: 1, processor: async (_input, output) => {
    await Bun.write(output, png); return { width: 1, height: 1, fileSize: png.length };
  } });
  const url = instance.server.url.toString().replace(/\/$/, '');
  try {
    expect((await fetch(`${url}/health`)).status).toBe(200);
    expect((await fetch(`${url}/jobs`, { method: 'POST', body: upload('invalid') })).status).toBe(400);
    expect((await fetch(`${url}/jobs`, { method: 'POST', body: upload('auto', new File(['bad'], 'x.txt', { type: 'text/plain' })) })).status).toBe(415);
    expect((await fetch(`${url}/health`, { headers: { Origin: 'https://untrusted.example' } })).status).toBe(403);
    const response = await fetch(`${url}/jobs`, { method: 'POST', body: upload() });
    expect(response.status).toBe(202);
    const { id, token } = await response.json(); const state = await poll(url, id, token);
    expect(state.status).toBe('completed'); expect(state.result.width).toBe(1);
    expect(state.result.isDemoResult).toBe(false);
    const result = await fetch(`${url}${state.result.resultPath}`);
    expect(result.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await result.arrayBuffer())).toEqual(png);
    expect((await fetch(`${url}/jobs`, { method: 'POST', body: upload() })).status).toBe(429);
    expect((await fetch(`${url}/jobs/${crypto.randomUUID()}`)).status).toBe(404);
  } finally { await instance.stop(); }
});
test('cancel stops processing and refunds reserved quota', async () => {
  const instance = await createServer({ port: 0, dailyLimit: 1, processor: (_input, _output, _settings, job) => new Promise((_r, reject) => {
    job.controller.signal.addEventListener('abort', () => reject(new Error('canceled')), { once: true });
  }) });
  const url = instance.server.url.toString().replace(/\/$/, '');
  try {
    const { id, token } = await (await fetch(`${url}/jobs`, { method: 'POST', body: upload() })).json();
    await new Promise(r => setTimeout(r, 30));
    expect((await (await fetch(`${url}/jobs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).json()).status).toBe('canceled');
    await new Promise(r => setTimeout(r, 30));
    expect((await fetch(`${url}/jobs`, { method: 'POST', body: upload() })).status).toBe(202);
  } finally { await instance.stop(); }
});
test('real local image processing produces measured PNG and rejects corrupt input', async () => {
  const instance = await createServer({ port: 0, dailyLimit: 10 });
  const url = instance.server.url.toString().replace(/\/$/, '');
  try {
    // Generate a real source with Pillow to avoid brittle hand-encoded fixtures.
    const child = Bun.spawn(['backend/.venv/bin/python', '-c', 'from PIL import Image; import sys; Image.new("RGB", (32,24), "orange").save(sys.stdout.buffer, "PNG")'], { stdout: 'pipe' });
    const source = await new Response(child.stdout).arrayBuffer(); await child.exited;
    for (const mode of ['auto', 'face_enhance', 'photo_restore', 'hd_upscale', 'sharpen', 'color_enhance', 'remove_bg']) {
      const { id, token } = await (await fetch(`${url}/jobs`, { method: 'POST', body: upload(mode, new File([source], 'photo.png', { type: 'image/png' })) })).json();
      const state = await poll(url, id, token);
      expect(state.status).toBe('completed');
      expect(state.result.width).toBe(mode === 'hd_upscale' ? 64 : 32);
      expect(state.result.height).toBe(mode === 'hd_upscale' ? 48 : 24);
      if (mode === 'remove_bg') {
        const check = Bun.spawn(['backend/.venv/bin/python', '-c', 'from PIL import Image; import sys; im=Image.open(sys.argv[1]); assert im.mode == "RGBA"; assert im.getchannel("A").getextrema()[0] < 255', `${instance.dataDirectory}/${id}.png`], { stdout: 'pipe', stderr: 'pipe' });
        expect(await check.exited).toBe(0);
      }
    }
    const { id, token } = await (await fetch(`${url}/jobs`, { method: 'POST', body: upload('auto', new File(['corrupt'], 'photo.png', { type: 'image/png' })) })).json();
    expect((await poll(url, id, token)).status).toBe('failed');
  } finally { await instance.stop(); }
}, 60000);

test('job IDs alone cannot read, download or cancel photos; consent must match the provider', async () => {
  const app = await createServer({ port: 0, processor: async (_input, output) => { await Bun.write(output, png); return { width: 1, height: 1 }; } });
  const base = app.server.url.toString().replace(/\/$/, '');
  try {
    const form = upload(); form.set('processingProvider', 'replicate');
    expect((await fetch(`${base}/jobs`, { method: 'POST', body: form })).status).toBe(409);
    const { id, token } = await (await fetch(`${base}/jobs`, { method: 'POST', body: upload() })).json();
    await poll(base, id, token);
    for (const method of ['GET', 'DELETE']) expect((await fetch(`${base}/jobs/${id}`, { method })).status).toBe(404);
    expect((await fetch(`${base}/jobs/${id}/result`)).status).toBe(404);
    expect((await fetch(`${base}/jobs/${id}/result?token=${'0'.repeat(64)}`)).status).toBe(404);
    expect((await fetch(`${base}/jobs/${id}`, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
    expect((await fetch(`${base}/jobs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
    expect(await Bun.file(`${app.dataDirectory}/${id}.png`).exists()).toBe(false);
    expect((await fetch(`${base}/jobs/${id}/result?token=${token}`)).status).toBe(404);
  } finally { await app.stop(); }
});

test('completed private jobs and quota survive restart', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'pixelrevive-restart-'));
  const options = { port: 0, dailyLimit: 1, dataDirectory, processor: async (_input, output) => { await Bun.write(output, png); return { width: 1, height: 1 }; } };
  let app = await createServer(options);
  try {
    let base = app.server.url.toString().replace(/\/$/, '');
    const { id, token } = await (await fetch(`${base}/jobs`, { method: 'POST', body: upload() })).json();
    await poll(base, id, token); await app.stop(); app = await createServer(options);
    base = app.server.url.toString().replace(/\/$/, '');
    const state = await poll(base, id, token);
    expect(state.status).toBe('completed');
    expect((await fetch(`${base}${state.result.resultPath}`)).status).toBe(200);
    expect((await fetch(`${base}/jobs`, { method: 'POST', body: upload() })).status).toBe(429);
  } finally { await app.stop(); await rm(dataDirectory, { recursive: true, force: true }); }
});

test('expired results become inaccessible and cleanup removes photo files', async () => {
  const { serverConfig } = await import('./config');
  const app = await createServer({ port: 0, config: { ...serverConfig(), ttl: 100 }, processor: async (_input, output) => { await Bun.write(output, png); return { width: 1, height: 1 }; } });
  const base = app.server.url.toString().replace(/\/$/, '');
  try {
    const { id, token } = await (await fetch(`${base}/jobs`, { method: 'POST', body: upload() })).json();
    expect((await poll(base, id, token)).status).toBe('completed');
    await new Promise(resolve => setTimeout(resolve, 120));
    expect((await fetch(`${base}/jobs/${id}/result?token=${token}`)).status).toBe(404);
    await app.cleanup(); expect(await Bun.file(`${app.dataDirectory}/${id}.png`).exists()).toBe(false);
    expect(await Bun.file(`${app.dataDirectory}/${id}.input`).exists()).toBe(false);
  } finally { await app.stop(); }
});
test('external-provider input normalization strips EXIF before upload', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'pixelrevive-exif-'));
  const input = join(dataDirectory, 'input.jpg'); const output = join(dataDirectory, 'sanitized.png');
  try {
    const source = Bun.spawn(['backend/.venv/bin/python', '-c', 'from PIL import Image; import sys; im=Image.new("RGB",(16,12),"orange"); e=Image.Exif(); e[270]="private metadata"; im.save(sys.argv[1],"JPEG",exif=e)', input]);
    expect(await source.exited).toBe(0);
    const worker = Bun.spawn(['backend/.venv/bin/python', 'backend/worker.py', input, output, JSON.stringify({ mode: 'sanitize' })]);
    expect(await worker.exited).toBe(0);
    const check = Bun.spawn(['backend/.venv/bin/python', '-c', 'from PIL import Image; import sys; im=Image.open(sys.argv[1]); assert len(im.getexif()) == 0; assert im.size==(16,12)', output]);
    expect(await check.exited).toBe(0);
  } finally { await rm(dataDirectory, { recursive: true, force: true }); }
});

test('worker enforces smaller input and upscale output budgets for the MVP', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'pixelrevive-pixels-'));
  const input = join(dataDirectory, 'input.png'); const output = join(dataDirectory, 'output.png');
  try {
    const source = Bun.spawn(['backend/.venv/bin/python', '-c', 'from PIL import Image; import sys; Image.new("RGB",(250,500),"orange").save(sys.argv[1])', input]);
    expect(await source.exited).toBe(0);
    for (const [settings, limits, message] of [
      [{ mode: 'auto' }, { MAX_INPUT_PIXELS: '100000', MAX_OUTPUT_PIXELS: '400000' }, 'input pixel limit'],
      [{ mode: 'hd_upscale', scale: 2 }, { MAX_INPUT_PIXELS: '200000', MAX_OUTPUT_PIXELS: '400000' }, 'Output exceeds'],
    ]) {
      const worker = Bun.spawn(['backend/.venv/bin/python', 'backend/worker.py', input, output, JSON.stringify(settings)], { env: { ...process.env, ...limits }, stdout: 'pipe', stderr: 'pipe' });
      const error = await new Response(worker.stderr).text();
      expect(await worker.exited).toBe(1); expect(error).toContain(message);
      expect(await Bun.file(output).exists()).toBe(false);
    }
  } finally { await rm(dataDirectory, { recursive: true, force: true }); }
});
