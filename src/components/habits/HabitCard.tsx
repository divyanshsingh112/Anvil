"use client";

import { Habit } from "@/types";
import { Sword, Sparkles, Zap, Edit2, Trash2 } from "lucide-react";

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onArchive: (id: string) => void;
}

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];

export default function HabitCard({ habit, onEdit, onArchive }: HabitCardProps) {
  const getClassIcon = () => {
    switch (habit.class) {
      case "warrior":
        return <Sword className="h-5 w-5 text-red-400" />;
      case "mage":
        return <Sparkles className="h-5 w-5 text-indigo-400" />;
      case "rogue":
        return <Zap className="h-5 w-5 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getDifficultyColor = () => {
    switch (habit.difficulty) {
      case "novice":
        return "text-green-400 bg-green-950/30 border-green-800";
      case "adept":
        return "text-yellow-400 bg-yellow-950/30 border-yellow-800";
      case "master":
        return "text-red-400 bg-red-950/30 border-red-800";
      default:
        return "text-gray-400 bg-gray-950/30 border-gray-800";
    }
  };

  const isDayActive = (index: number) => {
    if (!habit.activeDays) return true; // null means all days active
    return habit.activeDays.includes(index);
  };

  return (
    <div
      className="rounded-xl border p-5 shadow-sm transition-all hover:shadow-md"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              borderColor: "var(--border)",
            }}
          >
            {getClassIcon()}
          </div>
          <div>
            <h3
              className="text-lg font-bold capitalize"
              style={{ color: "var(--text-primary)" }}
            >
              {habit.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getDifficultyColor()}`}
              >
                {habit.difficulty}
              </span>
              <span
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                {habit.class}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(habit)}
            className="rounded-lg p-2 transition-colors hover:bg-slate-800"
            title="Edit Quest"
          >
            <Edit2 className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          </button>
          <button
            onClick={() => onArchive(habit.id)}
            className="rounded-lg p-2 transition-colors hover:bg-red-950/30"
            title="Archive Quest"
          >
            <Trash2 className="h-4 w-4" style={{ color: "var(--danger)" }} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-1">
          {DAYS_OF_WEEK.map((day, idx) => {
            const active = isDayActive(idx);
            return (
              <div
                key={idx}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  {day}
                </span>
                <div
                  className="h-7 w-7 rounded-full border flex items-center justify-center text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: active ? "var(--accent-purple)" : "transparent",
                    borderColor: active ? "var(--accent-purple)" : "var(--border)",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  ✓
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
