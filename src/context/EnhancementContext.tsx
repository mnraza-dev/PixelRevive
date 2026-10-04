import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { EnhancementJob, EnhancementSettings, ImageAsset } from '../types';
import { getAIProvider } from '../services/ai-provider';
import { checkCancellation } from '../services/abort';
import { StorageService } from '../services/storage';
import { useAuth } from './AuthContext';

interface EnhancementContextType {
  activeJob: EnhancementJob | null;
  draftImage: ImageAsset | null;
  setDraftImage: (image: ImageAsset | null) => void;
  openHistoryJob: (jobId: string) => void;
  history: EnhancementJob[];
  defaultSettings: EnhancementSettings;
  startEnhancement: (image: ImageAsset, customSettings?: Partial<EnhancementSettings>) => Promise<EnhancementJob>;
  cancelActiveJob: () => void;
  deleteHistoryItem: (jobId: string) => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const DEFAULT_SETTINGS: EnhancementSettings = {
  mode: 'auto',
  scale: 2,
  strength: 80,
  faceEnhanceStrength: 85,
  sharpening: 70,
  noiseReduction: 60,
  colorEnhancement: 75,
  preset: 'balanced',
};

const EnhancementContext = createContext<EnhancementContextType | undefined>(undefined);

export function EnhancementProvider({ children }: { children: React.ReactNode }) {
  const { user, deductCredit } = useAuth();
  const [draftImage, setDraftImage] = useState<ImageAsset | null>(null);
  const [activeJob, setActiveJob] = useState<EnhancementJob | null>(null);
  const [history, setHistory] = useState<EnhancementJob[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const refreshHistory = async () => {
    const saved = await StorageService.getHistory();
    setHistory(saved);
  };

  useEffect(() => {
    StorageService.getHistory().then(setHistory).catch(() => Alert.alert('Library unavailable', 'Your saved library could not be loaded. Check your device storage.'));
  }, []);

  const startEnhancement = async (
    image: ImageAsset,
    customSettings?: Partial<EnhancementSettings>
  ): Promise<EnhancementJob> => {
    if (!user) throw new Error('User must be logged in to enhance photos');

    if (controllerRef.current) throw new Error('A photo is already processing.');
    if (user.creditsRemaining <= 0) throw new Error('No free credits remaining today.');
    const provider = getAIProvider();
    const controller = new AbortController();
    controllerRef.current = controller;

    const settings: EnhancementSettings = {
      ...DEFAULT_SETTINGS,
      ...customSettings,
    };

    const initialJob = provider.createJob(user.id, image, settings);
    setActiveJob(initialJob);


    try {
      const completedJob = await provider.processJob(
        initialJob,
        (progress, currentStage) => {
          if (!controller.signal.aborted) {
            setActiveJob((prev) => (prev ? { ...prev, progress, currentStage, status: 'processing' } : null));
          }
        },
        controller.signal
      );
      checkCancellation(controller.signal);

      setActiveJob(completedJob);
      try {
        await deductCredit();
        await StorageService.saveJob(completedJob);
        await refreshHistory();
      } catch {
        Alert.alert('Your photo is ready', 'This edit could not be added to your saved library. Save it to your photos now and check your device storage.');
      }

      return completedJob;
    } catch (err: any) {
      const failedJob: EnhancementJob = {
        ...initialJob,
        status: 'failed',
        errorMessage: err?.message || 'Enhancement failed. Please try again.',
      };
      if (!controller.signal.aborted) setActiveJob(failedJob);
      throw err;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const cancelActiveJob = () => {
    controllerRef.current?.abort();
    setActiveJob(null);
  };

  const openHistoryJob = (jobId: string) => {
    const job = history.find(item => item.id === jobId);
    if (job) setActiveJob(job);
  };

  const deleteHistoryItem = async (jobId: string) => {
    await StorageService.deleteJob(jobId);
    await refreshHistory();
  };

  return (
    <EnhancementContext.Provider
      value={{
        activeJob,
        draftImage,
        setDraftImage,
        openHistoryJob,
        history,
        defaultSettings: DEFAULT_SETTINGS,
        startEnhancement,
        cancelActiveJob,
        deleteHistoryItem,
        refreshHistory,
      }}
    >
      {children}
    </EnhancementContext.Provider>
  );
}

export function useEnhancement() {
  const context = useContext(EnhancementContext);
  if (!context) {
    throw new Error('useEnhancement must be used within an EnhancementProvider');
  }
  return context;
}
