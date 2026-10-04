import type { User } from '../types';
export const DAILY_FREE_CREDITS = 3;
export function refillDailyCredits(user: User, today = new Date().toISOString().slice(0, 10)): User {
  // Preserve existing same-day credits, including users migrated without a refill date.
  if (!user.lastCreditRefillDate) return { ...user, lastCreditRefillDate: today };
  if (user.lastCreditRefillDate === today) return user;
  return { ...user, creditsRemaining: DAILY_FREE_CREDITS, lastCreditRefillDate: today };
}
