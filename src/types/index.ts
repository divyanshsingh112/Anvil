export type HabitClass = "warrior" | "mage" | "rogue";
export type HabitDifficulty = "novice" | "adept" | "master";

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
}
