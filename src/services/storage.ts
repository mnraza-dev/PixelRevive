import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths, Directory } from 'expo-file-system';
import { Platform } from 'react-native';
import type { User, EnhancementJob } from '../types';
import { refillDailyCredits } from './credits';

const KEYS = { USER: '@pixelrevive_user', HISTORY: '@pixelrevive_history', SETTINGS: '@pixelrevive_settings', GUEST: '@pixelrevive_guest' };
const MAX_HISTORY = 50;
function validUser(user: unknown): user is User {
  if (!user || typeof user !== 'object') return false;
  const value = user as Partial<User>;
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.email === 'string' && typeof value.isGuest === 'boolean' && ['free', 'pro', 'premium'].includes(value.tier || '') && Number.isInteger(value.creditsRemaining) && (value.creditsRemaining ?? -1) >= 0 && Number.isInteger(value.totalEnhancements) && (value.totalEnhancements ?? -1) >= 0;
}
let historyWrite: Promise<void> = Promise.resolve();
function serializeHistory<T>(operation: () => Promise<T>): Promise<T> {
  const next = historyWrite.then(operation);
  historyWrite = next.then(() => {}, () => {});
  return next;
}
function deletePhotoFiles(job: EnhancementJob) {
  if (Platform.OS === 'web') return;
  const directory = new Directory(Paths.document, 'enhancements');
  for (const uri of [job.image?.uri, job.result?.resultImageUrl]) {
    // Only remove files owned by this app's history; never the user's camera roll.
    if (!uri?.startsWith(`${directory.uri.replace(/\/$/, '')}/`)) continue;
    const file = new File(uri); if (file.exists) file.delete();
  }
}
export const StorageService = {
  async getUser(): Promise<User | null> {
    const data = await AsyncStorage.getItem(KEYS.USER);
    if (!data) return null;
    try { const user = JSON.parse(data); return validUser(user) ? user : null; }
    catch { return null; }
  },
  async saveUser(user: User): Promise<void> {
    await AsyncStorage.multiSet([[KEYS.USER, JSON.stringify(user)], [KEYS.GUEST, JSON.stringify(user)]]);
  },
  async getGuest(): Promise<User | null> {
    const data = await AsyncStorage.getItem(KEYS.GUEST);
    try { const user = data ? JSON.parse(data) : null; return validUser(user) && user.isGuest ? refillDailyCredits(user) : null; }
    catch { return null; }
  },
  async clearUser(): Promise<void> { await AsyncStorage.removeItem(KEYS.USER); },
  async getHistory(): Promise<EnhancementJob[]> {
    const data = await AsyncStorage.getItem(KEYS.HISTORY);
    try {
      const history = data ? JSON.parse(data) : [];
      return Array.isArray(history) ? history.filter(job => typeof job?.id === 'string' && typeof job?.image?.uri === 'string' && typeof job?.result?.resultImageUrl === 'string' && typeof job?.settings?.mode === 'string' && Number.isFinite(job?.image?.width) && Number.isFinite(job?.image?.height) && Number.isFinite(job?.result?.width) && Number.isFinite(job?.result?.height)).slice(0, MAX_HISTORY) : [];
    } catch { return []; }
  },
  async saveJob(job: EnhancementJob): Promise<void> {
    return serializeHistory(async () => {
      const history = await this.getHistory();
      const updated = [job, ...history.filter(item => item.id !== job.id)];
      await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(updated.slice(0, MAX_HISTORY)));
      for (const expired of updated.slice(MAX_HISTORY)) deletePhotoFiles(expired);
    });
  },
  async deleteJob(jobId: string): Promise<void> {
    return serializeHistory(async () => {
      const history = await this.getHistory();
      const removed = history.find(item => item.id === jobId);
      await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(history.filter(item => item.id !== jobId)));
      if (removed) deletePhotoFiles(removed);
    });
  },
  async clearAll(): Promise<void> {
    return serializeHistory(async () => {
      await AsyncStorage.multiRemove(Object.values(KEYS));
      if (Platform.OS !== 'web') { const directory = new Directory(Paths.document, 'enhancements'); if (directory.exists) directory.delete(); }
    });
  },
  async addDailyCreditRefillIfNeeded(): Promise<void> {
    const user = await this.getUser();
    if (user) await this.saveUser(refillDailyCredits(user));
  },
};
