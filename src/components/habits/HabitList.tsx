"use client";

import { Habit, ToggleResponse } from "@/types";
import HabitCard from "./HabitCard";
import { useLabels } from "@/hooks/useLabels";
import { Plus } from "lucide-react";

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
    return labels.emptyStateLabel;
  };

  const getButtonText = () => {
    return labels.createActionLabel;
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

      {isTodayPeriod && (
        <button
          onClick={onCreateQuestClick}
          className="group flex flex-col items-center justify-center min-h-[220px] rounded-xl border border-dashed p-6 text-center transition-all duration-200 hover:border-purple-500/50 hover:bg-purple-500/5"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl border mb-3 transition-transform group-hover:scale-110"
            style={{
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              borderColor: "rgba(168, 85, 247, 0.3)",
              color: "#c084fc",
            }}
          >
            <Plus className="h-6 w-6" />
          </div>
          <span className="text-sm font-bold text-white group-hover:text-purple-300">
            {getButtonText()}
          </span>
          <span className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Add another active habit to your journal
          </span>
        </button>
      )}
    </div>
  );
}
