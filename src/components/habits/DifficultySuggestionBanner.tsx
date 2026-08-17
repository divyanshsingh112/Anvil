"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Check, X } from "lucide-react";

interface DifficultySuggestionProps {
  habitId: string;
  onDifficultyUpdated?: (newDifficulty: string) => void;
}

interface EvaluationData {
  habitId: string;
  habitName: string;
  currentDifficulty: string;
  targetDifficulty: string | null;
  recommendation: "suggest_harder" | "suggest_easier" | "none";
  status: "eligible" | "insufficient_data" | "cooldown";
  metrics: {
    completionRate: number;
    streakVolatility: number;
    lastMinuteRate: number;
    scheduledSlots: number;
    completionsCount: number;
    habitAgeDays: number;
  } | null;
  cooldownRemainingDays?: number;
  reason: string;
  energyNudgeApplied?: boolean;
  energyReason?: string;
}

export default function DifficultySuggestionBanner({
  habitId,
  onDifficultyUpdated,
}: DifficultySuggestionProps) {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissedLocally, setDismissedLocally] = useState(false);

  useEffect(() => {
    const fetchSuggestion = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/habits/${habitId}/difficulty-suggestion`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch difficulty suggestion", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSuggestion();
  }, [habitId]);

  if (isLoading || !data || dismissedLocally) return null;
  if (data.status !== "eligible" || data.recommendation === "none" || !data.targetDifficulty) {
    return null; // Suppressed if in cooldown, insufficient data, or no suggestion
  }

  const isHarder = data.recommendation === "suggest_harder";

  const handleAction = async (action: "accept" | "dismiss") => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/habits/${habitId}/difficulty-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok && action === "accept" && data.targetDifficulty) {
        onDifficultyUpdated?.(data.targetDifficulty);
      }
      setDismissedLocally(true);
    } catch (err) {
      console.error(`Failed to ${action} suggestion`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden transition-all duration-300 ${
        isHarder
          ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
          : "bg-cyan-950/20 border-cyan-500/30 text-cyan-200"
      }`}
    >
      <div className="flex items-start gap-3 flex-1">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border mt-0.5 ${
            isHarder
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
              : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
          }`}
        >
          {isHarder ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <ArrowDownRight className="h-4 w-4" />
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Adaptive Difficulty Suggestion
            </span>
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                isHarder
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
              }`}
            >
              Suggest {data.targetDifficulty} (currently {data.currentDifficulty})
            </span>
            {data.energyNudgeApplied && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded border bg-amber-500/20 border-amber-500/40 text-amber-300">
                ⚡ Low Energy Callout
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-300 leading-snug font-medium">
            {data.reason}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          onClick={() => handleAction("dismiss")}
          disabled={isSubmitting}
          className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
        <button
          onClick={() => handleAction("accept")}
          disabled={isSubmitting}
          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
            isHarder
              ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20"
              : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
          Accept & Update
        </button>
      </div>
    </div>
  );
}
