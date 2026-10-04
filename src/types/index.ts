export type EnhancementMode =
  | 'auto'
  | 'face_enhance'
  | 'photo_restore'
  | 'hd_upscale'
  | 'sharpen'
  | 'color_enhance'
  | 'remove_bg';

export type ProcessingStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed';

export type OutputScale = 2 | 4;

export type Preset = 'natural' | 'balanced' | 'strong' | 'old_photo' | 'portrait' | 'custom';

export interface EnhancementSettings {
  mode: EnhancementMode;
  scale: OutputScale;
  strength: number; // 0-100
  faceEnhanceStrength: number; // 0-100
  sharpening: number; // 0-100
  noiseReduction: number; // 0-100
  colorEnhancement: number; // 0-100
  preset: Preset;
}

export interface ImageAsset {
  id: string;
  userId: string;
  uri: string;
  originalFilename: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize?: number;
  createdAt: number;
}

export interface EnhancementResult {
  id: string;
  jobId: string;
  resultImageUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  fileSize?: number;
  facesDetected?: number;
  processingTimeMs?: number;
  createdAt: number;
  isDemoResult?: boolean;
}

export interface EnhancementJob {
  id: string;
  userId: string;
  image: ImageAsset;
  settings: EnhancementSettings;
  status: ProcessingStatus;
  progress: number; // 0-100
  currentStage: string;
  stages: string[];
  provider: string;
  startedAt: number;
  completedAt?: number;
  result?: EnhancementResult;
  errorMessage?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isGuest: boolean;
  tier: 'free' | 'pro' | 'premium';
  creditsRemaining: number;
  totalEnhancements: number;
  createdAt: number;
  /** ISO date string (YYYY-MM-DD) of the last day credits were refilled */
  lastCreditRefillDate?: string;
}

export interface SubscriptionTier {
  id: 'free' | 'pro' | 'premium';
  name: string;
  price: string;
  period: string;
  credits: number;
  features: string[];
  popular?: boolean;
}