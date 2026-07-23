"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Clock, ShieldAlert, Sparkles, Brain } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";

interface ProcrastinationResponse {
  dangerZoneHours: number[] | "insufficient_data";
  lastMinuteRate: number | "insufficient_data";
  avoidancePattern: {
    avoidedClass: string;
    substituteClass: string;
    rate: number;
  } | null;
  confidence: {
    completionsCount: number;
    partialDaysCount: number;
  };
}

export default function ProcrastinationFingerprint() {
  const labels = useLabels();
  const [data, setData] = useState<ProcrastinationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFingerprint = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/ml/fingerprint");
        if (!res.ok) throw new Error("Failed to load procrastination analysis");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFingerprint();
  }, []);

  if (isLoading) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center p-6 rounded-xl border min-h-[350px]"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        <span className="text-xs text-slate-400 mt-2 font-medium">Running behavioral analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center p-6 rounded-xl border min-h-[350px] text-center"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <AlertCircle className="h-8 w-8 text-rose-500 mb-2" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Analysis Offline</span>
        <p className="text-[10px] text-slate-500 mt-1">{error || "Failed to query pipeline"}</p>
      </div>
    );
  }

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:00 ${period}`;
  };

  const getTranslatedClass = (cName: string) => {
    const normalized = cName.toLowerCase();
    if (normalized === "warrior") return labels.classWarrior;
    if (normalized === "mage") return labels.classMage;
    if (normalized === "rogue") return labels.classRogue;
    return cName;
  };

  const { dangerZoneHours, lastMinuteRate, avoidancePattern, confidence } = data;

  return (
    <div
      className="stat-card p-6 rounded-xl border flex flex-col gap-6 relative overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b pb-4" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg border"
          style={{
            backgroundColor: "rgba(168, 85, 247, 0.1)",
            borderColor: "rgba(168, 85, 247, 0.2)",
          }}
        >
          <Brain className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Procrastination Fingerprint</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Machine Learning Self-Awareness Panel</p>
        </div>
      </div>

      {/* Grid of 3 insights */}
      <div className="flex flex-col gap-5">
        {/* 1. Danger Zone */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Daily Danger Zone Hours</h3>
          </div>
          
          {dangerZoneHours === "insufficient_data" ? (
            <div className="text-[10px] text-slate-400 bg-slate-950/20 border border-slate-800/40 p-3 rounded-lg flex flex-col gap-1">
              <span className="font-bold text-slate-300">Not enough data yet</span>
              <p className="text-slate-500 leading-snug">
                Requires at least 10 timed completed {labels.habitPlural.toLowerCase()} in the last 30 days to build a representative map. (Currently tracked: {confidence.completionsCount}/10)
              </p>
            </div>
          ) : (
            <div className="bg-slate-950/30 border border-slate-800 p-3.5 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-amber-400 leading-tight">
                  {formatHour(dangerZoneHours[0])} - {formatHour((dangerZoneHours[2] + 1) % 24)}
                </p>
                <p className="text-[9px] text-slate-400 leading-snug mt-1 font-semibold">
                  This 3-hour waking window represents the period during which your scheduled activities are completed least frequently.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 2. Last-Minute completions */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Late-Night Execution Rate</h3>
          </div>
          
          {lastMinuteRate === "insufficient_data" ? (
            <div className="text-[10px] text-slate-400 bg-slate-950/20 border border-slate-800/40 p-3 rounded-lg flex flex-col gap-1">
              <span className="font-bold text-slate-300">Analyzing completion timing...</span>
              <p className="text-slate-500 leading-snug">
                Requires at least 10 non-skip completed {labels.habitPlural.toLowerCase()} in the last 30 days to calculate confidence thresholds.
              </p>
            </div>
          ) : (
            <div className="bg-slate-950/30 border border-slate-800 p-3.5 rounded-lg flex items-center justify-between">
              <div className="flex-1">
                <p className="text-lg font-black text-purple-400 leading-tight">
                  {lastMinuteRate}%
                </p>
                <p className="text-[9px] text-slate-400 leading-snug mt-1 font-semibold">
                  Percentage of your completed tasks checked off during late night hours (between 10 PM and 5 AM). Higher rates reflect late-day clustering.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. Avoidance Substitution */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Avoidance Substitution Pattern</h3>
          </div>
          
          {avoidancePattern === null ? (
            <div className="text-[10px] text-slate-400 bg-slate-950/20 border border-slate-800/40 p-3 rounded-lg flex flex-col gap-1">
              <span className="font-bold text-slate-300">Searching for substitutions...</span>
              <p className="text-slate-500 leading-snug">
                Requires at least 5 partial completion days to check if you substitute classes. (Observed partial days: {confidence.partialDaysCount}/5)
              </p>
            </div>
          ) : (
            <div className="bg-slate-950/30 border border-slate-800 p-3.5 rounded-lg">
              <p className="text-[10px] text-slate-300 leading-normal font-semibold">
                On days with partial check-offs, you consistently skip{" "}
                <span className="text-emerald-400 font-extrabold">{getTranslatedClass(avoidancePattern.avoidedClass)}</span> tasks while completing{" "}
                <span className="text-purple-400 font-extrabold">{getTranslatedClass(avoidancePattern.substituteClass)}</span> tasks.
              </p>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-[8px] font-black uppercase text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                  Pattern Strength: {Math.round(avoidancePattern.rate * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
