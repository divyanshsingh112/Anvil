"use client";

import { useState } from "react";
import { Habit } from "@/types";
import { useLabels } from "@/hooks/useLabels";
import { Plus } from "lucide-react";

interface ChainFormProps {
  activeHabits: Habit[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ChainForm({
  activeHabits,
  onSuccess,
  onCancel,
}: ChainFormProps) {
  const labels = useLabels();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleHabitToggle = (habitId: string) => {
    setSelectedIds((prev) =>
      prev.includes(habitId)
        ? prev.filter((id) => id !== habitId)
        : [...prev, habitId]
    );
  };

  const getFormTitle = () => {
    if (labels.habitSingular === "Quest") return "Forge Quest Chain";
    if (labels.habitSingular === "Lap") return "Assemble Lap Chain";
    if (labels.habitSingular === "Drill") return "Group Drill Chain";
    return "Create Habit Chain";
  };

  const getSubmitButtonText = () => {
    if (isSubmitting) return "Creating...";
    if (labels.habitSingular === "Quest") return "Forge Chain";
    return "Create Chain";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError("Chain name cannot be empty");
      return;
    }
    if (name.length > 50) {
      setError("Chain name cannot exceed 50 characters");
      return;
    }
    if (selectedIds.length < 2) {
      setError(`A chain must group at least 2 ${labels.habitPlural.toLowerCase()}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/chains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          habitIds: selectedIds,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create chain");
      }

      onSuccess();
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to create chain");
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
        {getFormTitle()}
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

      {/* Chain Name */}
      <div>
        <label
          htmlFor="chainName"
          className="mb-2 block text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Chain Name
        </label>
        <input
          id="chainName"
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
          placeholder="e.g. Morning Routine Link"
          disabled={isSubmitting}
        />
        <div className="mt-1 text-right text-xs" style={{ color: "var(--text-muted)" }}>
          {name.length}/50
        </div>
      </div>

      {/* Habits Selection */}
      <div>
        <span
          className="mb-2 block text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Select {labels.habitPlural} (Min 2)
        </span>
        {activeHabits.length === 0 ? (
          <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
            No active {labels.habitPlural.toLowerCase()} found. Create some first!
          </p>
        ) : (
          <div className="max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
            {activeHabits.map((habit) => {
              const isSelected = selectedIds.includes(habit.id);
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => handleHabitToggle(habit.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all text-xs font-bold ${
                    isSelected
                      ? "border-purple-500 bg-purple-950/20 text-purple-300"
                      : "hover:bg-slate-800"
                  }`}
                  style={{
                    backgroundColor: isSelected ? undefined : "var(--bg-tertiary)",
                    borderColor: isSelected ? undefined : "var(--border)",
                    color: isSelected ? undefined : "var(--text-primary)",
                  }}
                  disabled={isSubmitting}
                >
                  <div>
                    <div>{habit.name}</div>
                    <div className="text-[10px] text-slate-400 capitalize mt-0.5">
                      {habit.class} &bull; {habit.difficulty}
                    </div>
                  </div>
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                      isSelected ? "bg-purple-600 border-purple-500" : "border-slate-500"
                    }`}
                  >
                    {isSelected && <Plus className="h-3 w-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-slate-800"
          style={{ color: "var(--text-secondary)" }}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || selectedIds.length < 2}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-purple)" }}
        >
          {getSubmitButtonText()}
        </button>
      </div>
    </form>
  );
}
