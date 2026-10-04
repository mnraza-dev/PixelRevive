import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Alert } from 'react-native';
import { refillDailyCredits } from '../services/credits';
import { User } from '../types';
import { StorageService } from '../services/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginAsGuest: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  deductCredit: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await StorageService.addDailyCreditRefillIfNeeded();
        const saved = await StorageService.getUser();
        if (mounted) setUser(saved);
      } catch { if (mounted) Alert.alert('Storage unavailable', 'Your studio could not load its saved data. Check your device storage and try again.'); }
      finally { if (mounted) setIsLoading(false); }
    };
    void load();
    let refillTimer: ReturnType<typeof setTimeout>;
    const scheduleRefill = () => {
      const now = new Date();
      const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      refillTimer = setTimeout(() => { void load(); scheduleRefill(); }, nextDay - now.getTime() + 1000);
    };
    scheduleRefill();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { mounted = false; clearTimeout(refillTimer); subscription.remove(); };
  }, []);

  const loginAsGuest = async () => {
    setIsLoading(true);
    try {
      const previous = await StorageService.getGuest();
      const guestUser: User = previous || {
        id: `guest_${Date.now()}`, name: 'Guest User', email: '', isGuest: true,
        tier: 'free', creditsRemaining: 3, totalEnhancements: 0, createdAt: Date.now(),
        lastCreditRefillDate: new Date().toISOString().slice(0, 10),
      };
      await StorageService.saveUser(guestUser);
      setUser(guestUser);
    } finally { setIsLoading(false); }
  };

  const updateUser = async (data: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    await StorageService.saveUser(updatedUser);
    setUser(updatedUser);
  };

  const deductCredit = async (): Promise<boolean> => {
    if (!user || user.creditsRemaining <= 0) return false;
    const current = refillDailyCredits(user);
    const updatedUser = {
      ...current,
      creditsRemaining: Math.max(0, current.creditsRemaining - 1),
      totalEnhancements: user.totalEnhancements + 1,
    };
    await StorageService.saveUser(updatedUser);
    setUser(updatedUser);
    return true;
  };

  const logout = async () => {
    await StorageService.clearUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginAsGuest,
        updateUser,
        deductCredit,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
