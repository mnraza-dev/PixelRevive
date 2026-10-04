import type { EnhancementJob, EnhancementSettings, ImageAsset } from '../types';
import { MockAIProvider } from './ai-mock';
import { ReplicateAIProvider } from './ai-replicate';

export interface AIProvider {
  createJob(userId: string, image: ImageAsset, settings: EnhancementSettings): EnhancementJob;
  processJob(job: EnhancementJob, onProgress: (progress: number, stage: string) => void, signal?: AbortSignal): Promise<EnhancementJob>;
}

export function getAIProvider(): AIProvider {
  // Demo results must be explicitly requested. Missing configuration is an error.
  if (process.env.EXPO_PUBLIC_AI_PROVIDER === 'mock') {
    if (!__DEV__) throw new Error('Demo processing is unavailable in release builds.');
    return MockAIProvider;
  }
  return ReplicateAIProvider;
}
