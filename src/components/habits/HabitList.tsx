"use client";

import { Habit, ToggleResponse } from "@/types";
import HabitCard from "./HabitCard";
import { useLabels } from "@/hooks/useLabels";

interface HabitListProps {
  habits: Habit[];
  onEditHabit: (habit: Habit) => void;
  onArchiveHabit: (id: string) => void;
  onCreateQuestClick: () => void;
  onToggleHabit: (
    habitId: string,
    completed: boolean,
    options?: {
      timeBucket?: "morning" | "afternoon" | "evening" | "night" | null;
      timeAccuracy?: "confirmed" | "estimated" | "skip";
      customCompletedAt?: string;
    }
  ) => Promise<ToggleResponse | undefined>;
  isTodayPeriod: boolean;
}

export default function HabitList({
  habits,
  onEditHabit,
  onArchiveHabit,
  onCreateQuestClick,
  onToggleHabit,
  isTodayPeriod,
}: HabitListProps) {
  const labels = useLabels();

  const getEmptyMessage = () => {
    if (labels.habitSingular === "Quest") return "No quests yet — forge your first one";
    if (labels.habitSingular === "Lap") return "No laps yet — start your first one";
    if (labels.habitSingular === "Drill") return "No drills yet — plan your first one";
    return "No habits yet — create your first one";
  };

  const getButtonText = () => {
    if (labels.habitSingular === "Quest") return "Forge New Quest";
    if (labels.habitSingular === "Lap") return "Start New Lap";
    if (labels.habitSingular === "Drill") return "Plan New Drill";
    return "Create New Habit";
  };

  if (habits.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-4 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>
          {getEmptyMessage()}
        </p>
        <button
          onClick={onCreateQuestClick}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent-purple)" }}
        >
          {getButtonText()}
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
          onToggle={onToggleHabit}
          isTodayPeriod={isTodayPeriod}
        />
      ))}
    </div>
  );
}
