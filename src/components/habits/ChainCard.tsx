"use client";

import { useState } from "react";
import { Habit, ResolvedChain } from "@/types";
import { useLabels } from "@/hooks/useLabels";
import { Trash2, Link, Check, Loader2 } from "lucide-react";
import { isSameISTDay } from "@/lib/date-utils";

interface ChainCardProps {
  chain: ResolvedChain;
  onDeleteSuccess: () => void;
}

export default function ChainCard({
  chain,
  onDeleteSuccess,
}: ChainCardProps) {
  const labels = useLabels();
  const [isDeleting, setIsDeleting] = useState(false);

  const now = new Date();

  const isHabitCompletedToday = (habit: Habit) => {
    return !!habit.completions?.some((c) => c.date && isSameISTDay(c.date, now));
  };

  const completedCount = chain.habits.filter(isHabitCompletedToday).length;
  const isChainCompletedToday = chain.habits.length > 0 && completedCount === chain.habits.length;

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete this ${labels.chainLabel.toLowerCase()}? Your individual ${labels.habitPlural.toLowerCase()} and completion history will be completely unaffected.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/chains/${chain.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Failed to delete ${labels.chainLabel.toLowerCase()}`);
      }

      onDeleteSuccess();
    } catch (err) {
      const errorObj = err as Error;
      alert(errorObj.message || `Failed to delete ${labels.chainLabel.toLowerCase()}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="rounded-xl border p-5 transition-all duration-300 relative overflow-hidden"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: isChainCompletedToday ? "var(--accent-gold)" : "var(--border)",
        boxShadow: isChainCompletedToday
          ? "0 4px 20px -2px rgba(217, 119, 6, 0.2)"
          : "none",
      }}
    >
      {/* Glow highlight for complete chains */}
      {isChainCompletedToday && (
        <div
          className="absolute top-0 right-0 left-0 h-1"
          style={{
            background: "linear-gradient(90deg, transparent 0%, var(--accent-gold) 50%, transparent 100%)",
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              borderColor: isChainCompletedToday ? "var(--accent-gold)" : "var(--border)",
            }}
          >
            <Link
              className="h-4 w-4"
              style={{ color: isChainCompletedToday ? "var(--accent-gold)" : "var(--text-secondary)" }}
            />
          </div>
          <div>
            <h3
              className="text-base font-extrabold text-white tracking-tight"
            >
              {chain.name}
            </h3>
            <span
              className="text-[10px] font-bold uppercase tracking-wider block mt-0.5"
              style={{ color: isChainCompletedToday ? "var(--accent-gold)" : "var(--text-muted)" }}
            >
              {isChainCompletedToday
                ? `${labels.perfectDayLabel} Complete (+${chain.bonusXp} ${labels.xpLabel})`
                : `${completedCount} of ${chain.habits.length} Complete (+${chain.bonusXp} ${labels.xpLabel} Bonus)`}
            </span>
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="rounded-lg p-2 transition-colors hover:bg-red-950/30"
          title={`Delete ${labels.chainLabel}`}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-muted)" }} />
          ) : (
            <Trash2 className="h-4 w-4" style={{ color: "var(--danger)" }} />
          )}
        </button>
      </div>

      {/* Habits List */}
      <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        {chain.habits.map((habit) => {
          const completed = isHabitCompletedToday(habit);
          return (
            <div
              key={habit.id}
              className="flex items-center justify-between p-2.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: completed ? "rgba(16, 185, 129, 0.3)" : "var(--border)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center transition-all ${
                    completed
                      ? "bg-emerald-500 border-emerald-400 text-white"
                      : "border-slate-500"
                  }`}
                >
                  {completed && <Check className="h-3 w-3" />}
                </div>
                <span
                  className={`font-semibold capitalize ${
                    completed ? "line-through opacity-60 text-slate-400" : "text-white"
                  }`}
                >
                  {habit.name}
                </span>
              </div>
              <span
                className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded"
                style={{
                  backgroundColor: "rgba(148, 163, 184, 0.1)",
                  color: "var(--text-secondary)",
                }}
              >
                {habit.class}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
