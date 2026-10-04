import { EnhancementJob, EnhancementResult, EnhancementSettings, ImageAsset } from '../types';
import { AIProvider } from './ai-provider';
import { checkCancellation } from './abort';

// DEMO_PRESETS_RESULTS kept as-is for the mock fallback
export const DEMO_PRESETS_RESULTS: Record<string, { before: string; after: string; faces: number }> = {
  face_enhance: {
    before: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=40&blur=2',
    after: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=95',
    faces: 1,
  },
  photo_restore: {
    before: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=40',
    after: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=95',
    faces: 1,
  },
  hd_upscale: {
    before: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=50',
    after: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1600&auto=format&fit=crop&q=100',
    faces: 1,
  },
  auto: {
    before: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=50',
    after: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&auto=format&fit=crop&q=95',
    faces: 1,
  },
  sharpen: {
    before: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=40',
    after: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&auto=format&fit=crop&q=95',
    faces: 1,
  },
  color_enhance: {
    before: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&auto=format&fit=crop&q=40',
    after: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=1200&auto=format&fit=crop&q=95',
    faces: 1,
  },
};

export const PROCESSING_STAGES = [
  'Uploading and validating image...',
  'Analyzing photo quality and noise...',
  'Detecting facial structures and keypoints...',
  'Restoring eyes, skin, and fine details...',
  'Upscaling resolution with neural super-sampling...',
  'Applying color balancing and dynamic range fix...',
  'Finalizing enhanced masterpiece...',
];

/**
 * MockAIProvider implements the AIProvider interface.
 * This allows runtime swapping between the mock and real Replicate provider.
 */
export const MockAIProvider: AIProvider = {
  createJob(userId: string, image: ImageAsset, settings: EnhancementSettings): EnhancementJob {
    return {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      image,
      settings,
      status: 'queued',
      progress: 0,
      currentStage: PROCESSING_STAGES[0],
      stages: PROCESSING_STAGES,
      provider: 'PixelRevive Neural Core (Demo v2.4)',
      startedAt: Date.now(),
    };
  },

  async processJob(
    job: EnhancementJob,
    onProgress: (progress: number, stage: string) => void,
    signal?: AbortSignal
  ): Promise<EnhancementJob> {
    if (job.settings.mode === 'remove_bg') throw new Error('Background removal requires the backend; demo mode does not support it.');
    const totalStages = PROCESSING_STAGES.length;

    for (let i = 0; i < totalStages; i++) {
      checkCancellation(signal);
      const stage = PROCESSING_STAGES[i];
      const progress = Math.round(((i + 1) / totalStages) * 100);
      onProgress(progress, stage);

      // Simulate realistic AI network & computation delay (around 500-900ms per stage)
      await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));
    }

    checkCancellation(signal);
    const demoPreset = DEMO_PRESETS_RESULTS[job.settings.mode] || DEMO_PRESETS_RESULTS.auto;

    const result: EnhancementResult = {
      id: `res_${Date.now()}`,
      jobId: job.id,
      resultImageUrl: demoPreset.after,
      thumbnailUrl: demoPreset.after,
      width: (job.image.width || 1080) * job.settings.scale,
      height: (job.image.height || 1080) * job.settings.scale,
      fileSize: 2450000,
      facesDetected: demoPreset.faces,
      processingTimeMs: Date.now() - job.startedAt,
      createdAt: Date.now(),
      isDemoResult: true,
    };

    return {
      ...job,
      status: 'completed',
      progress: 100,
      currentStage: 'Completed',
      completedAt: Date.now(),
      result,
    };
  },
};
