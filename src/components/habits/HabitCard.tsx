"use client";

import { useState } from "react";
import { Habit } from "@/types";
import { Sword, Sparkles, Zap, Edit2, Trash2, Clock } from "lucide-react";

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onArchive: (id: string) => void;
  onToggle: (
    habitId: string,
    completed: boolean,
    options?: {
      timeBucket?: "morning" | "afternoon" | "evening" | "night" | null;
      timeAccuracy?: "confirmed" | "estimated" | "skip";
      customCompletedAt?: string;
    }
  ) => Promise<void>;
  isTodayPeriod: boolean;
}

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];

export default function HabitCard({
  habit,
  onEdit,
  onArchive,
  onToggle,
  isTodayPeriod,
}: HabitCardProps) {
  const [isToggling, setIsToggling] = useState(false);

  // Check if completed today (based on server current date matching today)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  
  const todayCompletion = habit.completions?.find((c) => c.date.startsWith(todayStr));
  const isCompletedToday = !!todayCompletion;

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
    if (!habit.activeDays || habit.activeDays.length === 0) return true; // all days active
    return habit.activeDays.includes(index);
  };

  const handleCheckboxChange = async () => {
    if (!isTodayPeriod || isToggling) return;
    setIsToggling(true);
    try {
      await onToggle(habit.id, !isCompletedToday);
    } catch (err) {
      console.error(err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleTimeOverride = async (bucketValue: string) => {
    if (!isTodayPeriod || isToggling) return;
    setIsToggling(true);

    try {
      if (bucketValue === "now") {
        await onToggle(habit.id, true, {
          timeAccuracy: "confirmed",
          customCompletedAt: new Date().toISOString(),
        });
      } else if (bucketValue === "morning" || bucketValue === "afternoon" || bucketValue === "evening" || bucketValue === "night") {
        // Preset hours for estimates
        const overrideDate = new Date();
        if (bucketValue === "morning") overrideDate.setHours(8, 0, 0, 0);
        if (bucketValue === "afternoon") overrideDate.setHours(14, 0, 0, 0);
        if (bucketValue === "evening") overrideDate.setHours(19, 0, 0, 0);
        if (bucketValue === "night") overrideDate.setHours(23, 0, 0, 0);

        await onToggle(habit.id, true, {
          timeBucket: bucketValue,
          timeAccuracy: "confirmed",
          customCompletedAt: overrideDate.toISOString(),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className={`rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${
        isCompletedToday ? "opacity-85" : ""
      }`}
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: isCompletedToday ? "var(--accent-purple)" : "var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Completion Checkbox */}
          <div className="flex items-center h-10">
            <input
              type="checkbox"
              checked={isCompletedToday}
              disabled={!isTodayPeriod || isToggling}
              onChange={handleCheckboxChange}
              className={`h-5 w-5 rounded border cursor-pointer outline-none transition-all accent-purple-600 disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{
                borderColor: "var(--border)",
              }}
            />
          </div>

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
              className={`text-lg font-bold capitalize ${
                isCompletedToday ? "line-through opacity-60" : ""
              }`}
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

      {/* Weekday indicators */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-1">
          {DAYS_OF_WEEK.map((day, idx) => {
            const active = isDayActive(idx);
            return (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  {day}
                </span>
                <div
                  className="h-7 w-7 rounded-full border flex items-center justify-center text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: active ? "var(--bg-tertiary)" : "transparent",
                    borderColor: active ? "var(--border)" : "transparent",
                    color: active ? "var(--text-secondary)" : "var(--text-muted)",
                  }}
                >
                  ●
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time override section */}
      {isCompletedToday && isTodayPeriod && (
        <div
          className="mt-4 pt-3 border-t flex items-center justify-between gap-2"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <Clock className="h-3.5 w-3.5 text-purple-400" />
            <span>Time: </span>
            <span className="font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-purple-300">
              {todayCompletion.timeBucket} ({todayCompletion.timeAccuracy})
            </span>
          </div>

          <select
            value=""
            onChange={(e) => handleTimeOverride(e.target.value)}
            disabled={isToggling}
            className="text-[11px] font-semibold rounded px-2 py-1 outline-none border cursor-pointer"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="" disabled>Override Time</option>
            <option value="now">⚡ Just Now</option>
            <option value="morning">🌅 This Morning (8am)</option>
            <option value="afternoon">☀️ Afternoon (2pm)</option>
            <option value="evening">🌆 Evening (7pm)</option>
          </select>
        </div>
      )}
    </div>
  );
}
