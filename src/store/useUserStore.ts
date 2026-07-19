import { create } from "zustand";
import { UserGamification } from "@/types";

interface UserState extends UserGamification {
  isLoading: boolean;
  error: string | null;

  fetchUserStats: () => Promise<void>;
  applyToggleResult: (data: UserGamification) => void;
}

export const useUserStore = create<UserState>((set) => ({
  xp: 0,
  level: 1,
  coins: 0,
  streak: 0,
  longestStreak: 0,
  activeTheme: "default",
  isLoading: false,
  error: null,

  fetchUserStats: async () => {
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
        isLoading: false,
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
    });
  },
}));
