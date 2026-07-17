import { create } from "zustand";
import { Habit, HabitClass, HabitDifficulty } from "@/types";
import { useUserStore } from "@/store/useUserStore";

interface HabitStore {
  habits: Habit[];
  currentYear: number;
  currentMonth: number;
  isLoading: boolean;
  error: string | null;
  sessionTimeBucket: "morning" | "afternoon" | "evening" | "night" | null;
  
  setCurrentPeriod: (year: number, month: number) => void;
  setSessionTimeBucket: (bucket: "morning" | "afternoon" | "evening" | "night" | null) => void;
  fetchHabits: (year: number, month: number) => Promise<void>;
  createHabit: (data: {
    name: string;
    class: HabitClass;
    difficulty: HabitDifficulty;
    year: number;
    month: number;
    activeDays: number[] | null;
  }) => Promise<void>;
  updateHabit: (
    id: string,
    data: {
      name?: string;
      class?: HabitClass;
      difficulty?: HabitDifficulty;
      activeDays?: number[] | null;
    }
  ) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  toggleCompletion: (
    habitId: string,
    completed: boolean,
    options?: {
      timeBucket?: "morning" | "afternoon" | "evening" | "night" | null;
      timeAccuracy?: "confirmed" | "estimated" | "skip";
      customCompletedAt?: string;
    }
  ) => Promise<{
    completion: import("@/types").Completion | null;
    user: {
      xp: number;
      level: number;
      coins: number;
      streak: number;
      longestStreak: number;
    };
    leveledUp: boolean;
    perfectDay: boolean;
  } | undefined>;
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,
  isLoading: false,
  error: null,
  sessionTimeBucket: null,

  setCurrentPeriod: (year, month) => {
    set({ currentYear: year, currentMonth: month });
  },

  setSessionTimeBucket: (bucket) => {
    set({ sessionTimeBucket: bucket });
  },

  fetchHabits: async (year, month) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/habits?year=${year}&month=${month}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch habits");
      }
      const data = await res.json();
      set({ habits: data, isLoading: false });
    } catch (err) {
      const errorObj = err as Error;
      set({ error: errorObj.message, isLoading: false });
    }
  },

  createHabit: async (data) => {
    set({ isLoading: true, error: null });
    
    // Create temporary optimistic habit
    const tempId = `temp-${Date.now()}`;
    const optimisticHabit: Habit = {
      id: tempId,
      userId: "", // Filled by server
      name: data.name,
      class: data.class,
      difficulty: data.difficulty,
      year: data.year,
      month: data.month,
      activeDays: data.activeDays,
      createdAt: new Date().toISOString(),
      archivedAt: null,
      completions: [],
    };

    // Optimistically add to state
    set((state) => ({
      habits: [optimisticHabit, ...state.habits],
    }));

    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create habit");
      }

      const newHabit = await res.json();

      // Replace optimistic habit with the real one
      set((state) => ({
        habits: state.habits.map((h) => (h.id === tempId ? newHabit : h)),
        isLoading: false,
      }));
    } catch (err) {
      const errorObj = err as Error;
      // Revert optimistic insert
      set((state) => ({
        habits: state.habits.filter((h) => h.id !== tempId),
        error: errorObj.message,
        isLoading: false,
      }));
      throw err;
    }
  },

  updateHabit: async (id, data) => {
    set({ isLoading: true, error: null });

    const previousHabits = get().habits;

    // Optimistic update
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, ...data } : h
      ),
    }));

    try {
      const res = await fetch(`/api/habits/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update habit");
      }

      const updatedHabit = await res.json();
      
      // Update with exact server payload
      set((state) => ({
        habits: state.habits.map((h) => (h.id === id ? updatedHabit : h)),
        isLoading: false,
      }));
    } catch (err) {
      const errorObj = err as Error;
      // Revert to previous state
      set({ habits: previousHabits, error: errorObj.message, isLoading: false });
      throw err;
    }
  },

  archiveHabit: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`/api/habits/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to archive habit");
      }

      // Remove from list after confirmation of success to avoid flicker
      set((state) => ({
        habits: state.habits.filter((h) => h.id !== id),
        isLoading: false,
      }));
    } catch (err) {
      const errorObj = err as Error;
      set({ error: errorObj.message, isLoading: false });
      throw err;
    }
  },

  toggleCompletion: async (habitId, completed, options) => {
    set({ error: null });
    const previousHabits = get().habits;

    const now = new Date();
    // YYYY-MM-DD string representation of today's date for local matching
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Optimistically update the completions list inside the target habit
    set((state) => ({
      habits: state.habits.map((h) => {
        if (h.id !== habitId) return h;
        
        const currentCompletions = h.completions || [];
        let nextCompletions;
        
        if (completed) {
          // If already completed for today, do not duplicate
          if (currentCompletions.some((c) => c.date.startsWith(todayStr))) {
            return h;
          }
          
          const optimisticCompletion = {
            id: `temp-comp-${Date.now()}`,
            habitId,
            userId: "",
            date: todayStr,
            loggedAt: now.toISOString(),
            completedAt: (options?.customCompletedAt ? new Date(options.customCompletedAt) : now).toISOString(),
            timeBucket: options?.timeBucket || get().sessionTimeBucket || "morning",
            timeAccuracy: options?.timeAccuracy || (get().sessionTimeBucket ? "estimated" : "skip"),
            note: null,
          };
          nextCompletions = [...currentCompletions, optimisticCompletion];
        } else {
          nextCompletions = currentCompletions.filter((c) => !c.date.startsWith(todayStr));
        }

        return { ...h, completions: nextCompletions };
      }),
    }));

    try {
      const res = await fetch("/api/completions/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habitId,
          completed,
          timeBucket: options?.timeBucket ?? get().sessionTimeBucket,
          timeAccuracy: options?.timeAccuracy ?? (get().sessionTimeBucket ? "estimated" : "skip"),
          customCompletedAt: options?.customCompletedAt,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to toggle completion");
      }

      const responseData = await res.json();
      const { completion, user } = responseData;

      // Update the user store with new gamification values
      useUserStore.getState().applyToggleResult(user);

      set((state) => ({
        habits: state.habits.map((h) => {
          if (h.id !== habitId) return h;
          const currentCompletions = h.completions || [];
          let nextCompletions;
          if (completed && completion) {
            nextCompletions = currentCompletions.map((c) =>
              c.id.startsWith("temp-comp-") ? completion : c
            );
          } else {
            nextCompletions = currentCompletions.filter((c) => !c.date.startsWith(todayStr));
          }
          return { ...h, completions: nextCompletions };
        }),
      }));

      return responseData;
    } catch (err) {
      set({ habits: previousHabits });
      const errorObj = err as Error;
      set({ error: errorObj.message });
      throw err;
    }
  },
}));
