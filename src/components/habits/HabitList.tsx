"use client";

import { Habit } from "@/types";
import HabitCard from "./HabitCard";

interface HabitListProps {
  habits: Habit[];
  onEditHabit: (habit: Habit) => void;
  onArchiveHabit: (id: string) => void;
  onCreateQuestClick: () => void;
}

export default function HabitList({
  habits,
  onEditHabit,
  onArchiveHabit,
  onCreateQuestClick,
}: HabitListProps) {
  if (habits.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-4 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>
          No quests yet — forge your first one
        </p>
        <button
          onClick={onCreateQuestClick}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent-purple)" }}
        >
          Forge New Quest
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {habits.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          onEdit={onEditHabit}
          onArchive={onArchiveHabit}
        />
      ))}
    </div>
  );
}
