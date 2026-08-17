"use client";

import { useState } from "react";
import { Stethoscope, Sparkles, X, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";

interface HabitAutopsyModalProps {
  habitId: string;
  habitName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface AutopsyData {
  cached: boolean;
  isFallback: boolean;
  summaryText: string;
  actionableTip: string;
  dailyUsed?: number;
  dailyLimit?: number;
}

export default function HabitAutopsyModal({
  habitId,
  habitName,
  isOpen,
  onClose,
}: HabitAutopsyModalProps) {
  const [data, setData] = useState<AutopsyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAutopsy = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/habits/${habitId}/autopsy`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate habit autopsy");
      }
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch when opened if not loaded yet
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl flex flex-col gap-5 overflow-hidden"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        {/* Subtle top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: "rgba(168, 85, 247, 0.1)",
                borderColor: "rgba(168, 85, 247, 0.2)",
              }}
            >
              <Stethoscope className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">{habitName}</h3>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300">
                  AI Autopsy
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                On-Demand Behavioral Diagnosis & Insight
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        {!data && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
            <Sparkles className="h-10 w-10 text-purple-400 animate-pulse" />
            <div className="max-w-xs">
              <p className="text-xs font-bold text-white mb-1">Generate AI Habit Diagnosis?</p>
              <p className="text-[10px] text-slate-400">
                Analyzes structural friction using Phase 20–22 ML data. Structured metrics only — zero private free-text sent.
              </p>
            </div>
            <button
              onClick={fetchAutopsy}
              className="px-5 py-2.5 rounded-xl font-black text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Run Habit Autopsy
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            <span className="text-xs font-medium text-slate-400">Synthesizing behavioral metrics with Gemini 3.6 Flash...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Autopsy Error</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">{error}</p>
            <button
              onClick={fetchAutopsy}
              className="mt-2 text-[10px] font-bold text-purple-400 hover:underline flex items-center gap-1 self-start"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            {/* Status indicators */}
            <div className="flex items-center justify-between text-[9px]">
              <div className="flex items-center gap-2">
                {data.cached ? (
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold">
                    ⚡ Cached (Same-Day Response)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-bold flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Fresh AI Analysis
                  </span>
                )}
                {data.isFallback && (
                  <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-bold">
                    Fallback Output
                  </span>
                )}
              </div>
              {data.dailyUsed !== undefined && (
                <span className="text-slate-500 font-semibold">
                  Daily Usage: {data.dailyUsed}/{data.dailyLimit}
                </span>
              )}
            </div>

            {/* Diagnostic Summary */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold uppercase text-purple-400 tracking-wider">
                Behavioral Diagnosis
              </span>
              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                {data.summaryText}
              </p>
            </div>

            {/* Actionable Tip */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-emerald-400 tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Actionable Tip</span>
              </div>
              <p className="text-xs text-emerald-200 font-semibold leading-relaxed">
                {data.actionableTip}
              </p>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex justify-end border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-extrabold border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
