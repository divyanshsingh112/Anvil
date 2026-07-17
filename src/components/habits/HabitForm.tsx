"use client";

import { useState, useEffect } from "react";
import { Habit, HabitClass, HabitDifficulty } from "@/types";
import { useHabitStore } from "@/store/useHabitStore";
import { Sword, Sparkles, Zap } from "lucide-react";

interface HabitFormProps {
  mode: "create" | "edit";
  initialHabit?: Habit;
  onSuccess: () => void;
  onCancel: () => void;
  year: number;
  month: number;
}

const WEEKDAYS = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

export default function HabitForm({
  mode,
  initialHabit,
  onSuccess,
  onCancel,
  year,
  month,
}: HabitFormProps) {
  const { createHabit, updateHabit } = useHabitStore();

  const [name, setName] = useState("");
  const [habitClass, setHabitClass] = useState<HabitClass>("warrior");
  const [difficulty, setDifficulty] = useState<HabitDifficulty>("novice");
  const [activeDays, setActiveDays] = useState<number[] | null>(null);
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load initial values if editing
  useEffect(() => {
    if (mode === "edit" && initialHabit) {
      setName(initialHabit.name);
      setHabitClass(initialHabit.class);
      setDifficulty(initialHabit.difficulty);
      setActiveDays(initialHabit.activeDays);
    }
  }, [mode, initialHabit]);

  const handleDayToggle = (dayValue: number) => {
    if (activeDays === null) {
      // If activeDays was null (all days), start tracking only other days
      const allDays = [0, 1, 2, 3, 4, 5, 6];
      setActiveDays(allDays.filter((d) => d !== dayValue));
    } else {
      if (activeDays.includes(dayValue)) {
        const nextDays = activeDays.filter((d) => d !== dayValue);
        setActiveDays(nextDays.length === 0 ? [] : nextDays);
      } else {
        setActiveDays([...activeDays, dayValue]);
      }
    }
  };

  const handleAllDaysToggle = () => {
    if (activeDays === null) {
      setActiveDays([]); // Clear all
    } else {
      setActiveDays(null); // All days active (null in DB)
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validations
    if (!name || name.trim().length === 0) {
      setError("Quest name is required");
      return;
    }
    if (name.length > 50) {
      setError("Quest name must be 50 characters or less");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "create") {
        await createHabit({
          name: name.trim(),
          class: habitClass,
          difficulty,
          year,
          month,
          activeDays,
        });
      } else if (mode === "edit" && initialHabit) {
        await updateHabit(initialHabit.id, {
          name: name.trim(),
          class: habitClass,
          difficulty,
          activeDays,
        });
      }
      onSuccess();
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to save quest");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2
        className="text-2xl font-bold border-b pb-3"
        style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
      >
        {mode === "create" ? "Forge New Quest" : "Reforge Quest"}
      </h2>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "var(--danger)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Quest Name */}
      <div>
        <label
          htmlFor="questName"
          className="mb-2 block text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Quest Name
        </label>
        <input
          id="questName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
          placeholder="e.g. Daily Coding Forge"
        />
        <div className="mt-1 text-right text-xs" style={{ color: "var(--text-muted)" }}>
          {name.length}/50
        </div>
      </div>

      {/* Hero Class selection */}
      <div>
        <span
          className="mb-2 block text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Hero Class
        </span>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "warrior", label: "Warrior", icon: <Sword className="h-4 w-4" /> },
            { id: "mage", label: "Mage", icon: <Sparkles className="h-4 w-4" /> },
            { id: "rogue", label: "Rogue", icon: <Zap className="h-4 w-4" /> },
          ].map((c) => {
            const isSelected = habitClass === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setHabitClass(c.id as HabitClass)}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-all ${
                  isSelected
                    ? "border-purple-500 bg-purple-950/20 text-purple-300 ring-2 ring-purple-500/20"
                    : "opacity-75 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: isSelected ? undefined : "var(--bg-tertiary)",
                  borderColor: isSelected ? undefined : "var(--border)",
                  color: isSelected ? undefined : "var(--text-primary)",
                }}
              >
                {c.icon}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Difficulty selection */}
      <div>
        <span
          className="mb-2 block text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Difficulty
        </span>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "novice", label: "Novice" },
            { id: "adept", label: "Adept" },
            { id: "master", label: "Master" },
          ].map((d) => {
            const isSelected = difficulty === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id as HabitDifficulty)}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition-all ${
                  isSelected
                    ? "border-teal-500 bg-teal-950/20 text-teal-300 ring-2 ring-teal-500/20"
                    : "opacity-75 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: isSelected ? undefined : "var(--bg-tertiary)",
                  borderColor: isSelected ? undefined : "var(--border)",
                  color: isSelected ? undefined : "var(--text-primary)",
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Days multi-select */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Quest Schedule
          </span>
          <button
            type="button"
            onClick={handleAllDaysToggle}
            className="text-xs font-semibold hover:underline"
            style={{ color: "var(--accent-purple)" }}
          >
            {activeDays === null ? "Deselect All" : "Select All Days"}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day) => {
            const isSelected = activeDays === null || activeDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => handleDayToggle(day.value)}
                className={`flex h-10 w-full items-center justify-center rounded-lg border text-sm font-bold transition-all ${
                  isSelected
                    ? "border-purple-500 bg-purple-950/20 text-purple-300"
                    : "opacity-60"
                }`}
                style={{
                  backgroundColor: isSelected ? undefined : "var(--bg-tertiary)",
                  borderColor: isSelected ? undefined : "var(--border)",
                  color: isSelected ? undefined : "var(--text-primary)",
                }}
                title={day.label}
              >
                {day.label.substring(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          * Leaving all days selected logs quest as active daily (null value in database).
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-slate-800"
          style={{ color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-purple)" }}
        >
          {isSubmitting
            ? mode === "create"
              ? "Forging..."
              : "Reforging..."
            : mode === "create"
            ? "Forge Quest"
            : "Reforge"}
        </button>
      </div>
    </form>
  );
}
