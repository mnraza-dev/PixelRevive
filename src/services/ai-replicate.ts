import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths, Directory } from 'expo-file-system';
import type { EnhancementJob, EnhancementResult } from '../types';
import type { AIProvider } from './ai-provider';
import { checkCancellation, withRequestTimeout } from './abort';
import { resolveBackendUrl, checkBackendConnection, connectionError, readBackendResponse } from './backend-connection';

const STAGES = ['Validating image...', 'Processing image...', 'Saving result...'];
function backendUrl() {
  return resolveBackendUrl(process.env.EXPO_PUBLIC_BACKEND_PROXY_URL, !__DEV__);
}
async function request(path: string, options: RequestInit = {}) {
  return withRequestTimeout(async (signal) => {
    const response = await fetch(`${backendUrl()}${path}`, { ...options, signal });
    return readBackendResponse(response);
  }, 30000, options.signal).catch((error) => { throw connectionError(error, backendUrl()); });
}

export const ReplicateAIProvider: AIProvider = {
  createJob(userId, image, settings) {
    return { id: `job_${Date.now()}_${Math.random().toString(36).slice(2)}`, userId, image, settings, status: 'queued', progress: 0, currentStage: STAGES[0], stages: STAGES, provider: 'Backend processing', startedAt: Date.now() };
  },
  async processJob(job, onProgress, signal) {
    const base = backendUrl();
    checkCancellation(signal);
    onProgress(5, STAGES[0]);
    if (job.image.fileSize && job.image.fileSize > 15 * 1024 * 1024) throw new Error('Choose an image smaller than 15 MB.');
    await checkBackendConnection(base, signal, process.env.EXPO_PUBLIC_PROCESSING_PROVIDER || 'local', { width: job.image.width, height: job.image.height, scale: job.settings.mode === 'hd_upscale' ? job.settings.scale : 1 });
    const body = new FormData();
    if (Platform.OS === 'web' || /^https?:/.test(job.image.uri)) {
      const response = await fetch(job.image.uri, { signal });
      if (!response.ok) throw new Error('Could not read selected image.');
      body.append('image', await response.blob(), job.image.originalFilename);
    } else {
      // SDK 57 File implements Blob; expo/fetch streams native files.
      body.append('image', new File(job.image.uri), job.image.originalFilename);
    }
    body.append('processingProvider', process.env.EXPO_PUBLIC_PROCESSING_PROVIDER || 'local');
    body.append('settings', JSON.stringify(job.settings));
    // Once accepted, always retrieve the job ID before honoring cancellation.
    // This lets us cancel server work even if Cancel is tapped during upload.
    const initial = await withRequestTimeout(async (uploadSignal) => {
      const response = await expoFetch(`${base}/jobs`, { method: 'POST', body, signal: uploadSignal });
      return readBackendResponse(response);
    }, 60000).catch((error) => { throw connectionError(error, base); });
    if (typeof initial.id !== 'string' || !/^[a-f0-9-]{36}$/.test(initial.id)) throw new Error('The backend did not return a valid processing job.');
    if (typeof initial.token !== 'string' || !/^[a-f0-9]{64}$/.test(initial.token)) throw new Error('The backend did not return valid private job access.');
    const id = initial.id as string;
    const headers = { Authorization: `Bearer ${initial.token}` };
    let completed = false;
    try {
      for (let attempt = 0; attempt < 180; attempt++) {
        checkCancellation(signal);
        const state = await request(`/jobs/${id}`, { signal, headers });
        onProgress(state.progress, state.stage);
        if (state.status === 'failed' || state.status === 'canceled') throw new Error(state.error || 'Processing canceled.');
        if (state.status === 'completed') {
          if (!state.result || !Number.isInteger(state.result.width) || !Number.isInteger(state.result.height) || state.result.width < 1 || state.result.height < 1 || !state.result.resultPath?.startsWith(`/jobs/${id}/result?token=`)) throw new Error('The backend returned an invalid result.');
          let resultImageUrl = `${base}${state.result.resultPath}`;
          let savedImage = job.image;
          if (Platform.OS !== 'web') {
            const directory = new Directory(Paths.document, 'enhancements');
            directory.create({ idempotent: true, intermediates: true });
            const cached = await File.downloadFileAsync(resultImageUrl, new File(directory, `${id}.png`)).catch((error) => { throw connectionError(error, base); });
            resultImageUrl = cached.uri;
            // Picker files live in cache; keep a durable original for future comparisons.
            if (job.image.uri.startsWith('file://')) {
              const original = new File(directory, `${id}-original.${job.image.mimeType === 'image/png' ? 'png' : job.image.mimeType === 'image/webp' ? 'webp' : 'jpg'}`);
              new File(job.image.uri).copy(original);
              savedImage = { ...job.image, uri: original.uri };
            }
          }
          checkCancellation(signal);
          const result: EnhancementResult = { ...state.result, id: `res_${id}`, jobId: job.id, resultImageUrl, thumbnailUrl: resultImageUrl };
          completed = true;
          return { ...job, image: savedImage, stages: state.stages, provider: state.provider, status: 'completed', progress: 100, currentStage: 'Completed', completedAt: Date.now(), result } satisfies EnhancementJob;
        }
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Processing canceled.')); };
          const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 2000);
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) abort();
        });
      }
      throw new Error('Processing timed out. Try again with a smaller photo.');
    } finally {
      if (!completed) await request(`/jobs/${id}`, { method: 'DELETE', headers }).catch(() => {});
    }
  },
};
