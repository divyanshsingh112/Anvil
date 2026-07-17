export type HabitClass = "warrior" | "mage" | "rogue";
export type HabitDifficulty = "novice" | "adept" | "master";

export interface Completion {
  id: string;
  habitId: string;
  userId: string;
  date: string; // YYYY-MM-DD format from DB Date type
  loggedAt: Date | string;
  completedAt: Date | string;
  timeBucket: string;
  timeAccuracy: string;
  note: string | null;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  class: HabitClass;
  difficulty: HabitDifficulty;
  year: number;
  month: number;
  activeDays: number[] | null;
  createdAt: Date | string;
  archivedAt: Date | string | null;
  completions?: Completion[];
}
