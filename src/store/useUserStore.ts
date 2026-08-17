import { create } from "zustand";
import { UserGamification } from "@/types";

interface UserState extends UserGamification {
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  warriorCompletions: number;
  mageCompletions: number;
  rogueCompletions: number;
  trainingDataConsent: boolean;
  trainingConsentUpdatedAt: string | null;
  consistencyScore?: number;

  fetchUserStats: (force?: boolean) => Promise<void>;
  applyToggleResult: (data: UserGamification) => void;
  updateClassCompletions: (classType: "warrior" | "mage" | "rogue", increment: boolean) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  xp: 0,
  level: 1,
  coins: 0,
  streak: 0,
  longestStreak: 0,
  activeTheme: "default",
  streakShieldActive: false,
  freeFreezeCharges: 0,
  freezeActiveDate: null,
  warriorCompletions: 0,
  mageCompletions: 0,
  rogueCompletions: 0,
  trainingDataConsent: false,
  trainingConsentUpdatedAt: null,
  consistencyScore: undefined,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchUserStats: async (force = false) => {
    const state = get();
    // TTL Guard: Skip if already loading, or if fetched within last 60s (unless forced)
    if (state.isLoading) return;
    if (!force && state.lastFetched && Date.now() - state.lastFetched < 60_000) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/user/stats");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch user stats");
      }
      const data = await res.json();
      set({
        xp: data.xp,
        level: data.level,
        coins: data.coins,
        streak: data.streak,
        longestStreak: data.longestStreak,
        activeTheme: data.activeTheme,
        streakShieldActive: data.streakShieldActive,
        freeFreezeCharges: data.freeFreezeCharges,
        freezeActiveDate: data.freezeActiveDate,
        warriorCompletions: data.warriorCompletions || 0,
        mageCompletions: data.mageCompletions || 0,
        rogueCompletions: data.rogueCompletions || 0,
        trainingDataConsent: !!data.trainingDataConsent,
        trainingConsentUpdatedAt: data.trainingConsentUpdatedAt || null,
        consistencyScore: data.consistencyScore,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      const errorObj = err as Error;
      set({ error: errorObj.message, isLoading: false });
    }
  },

  applyToggleResult: (data) => {
    set({
      xp: data.xp,
      level: data.level,
      coins: data.coins,
      streak: data.streak,
      longestStreak: data.longestStreak,
      activeTheme: data.activeTheme,
      streakShieldActive: data.streakShieldActive,
      freeFreezeCharges: data.freeFreezeCharges,
      freezeActiveDate: data.freezeActiveDate,
    });
  },

  updateClassCompletions: (classType, increment) => {
    set((state) => {
      const field = `${classType}Completions` as "warriorCompletions" | "mageCompletions" | "rogueCompletions";
      const change = increment ? 1 : -1;
      return {
        [field]: Math.max(0, state[field] + change),
      };
    });
  },
}));
