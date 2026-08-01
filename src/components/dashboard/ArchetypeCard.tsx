"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Zap, Moon, Sunrise, TrendingUp, Sparkles } from "lucide-react";

interface ArchetypeResponse {
  archetype:
    | "steady_strategist"
    | "weekend_warrior"
    | "night_owl"
    | "momentum_builder"
    | "insufficient_data";
  features: {
    weekdayRate: number;
    weekendRate: number;
    eveningNightRatio: number;
    streakVolatility: number;
    lastMinuteRate: number;
    momentumTrend: number;
  } | null;
  classifierVersion: number;
  confidence: {
    completionsCount: number;
    accountAgeDays: number;
  };
}

const ARCHETYPE_META: Record<
  string,
  {
    label: string;
    tagline: string;
    description: string;
    icon: typeof Zap;
    gradient: string;
    accentColor: string;
    borderColor: string;
  }
> = {
  steady_strategist: {
    label: "Steady Strategist",
    tagline: "Disciplined & Consistent",
    description:
      "You complete habits on schedule with minimal procrastination. Your reliability is your superpower — keep building on this foundation.",
    icon: Sunrise,
    gradient: "from-emerald-500/20 to-teal-500/10",
    accentColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
  },
  weekend_warrior: {
    label: "Weekend Warrior",
    tagline: "Burst Performer",
    description:
      "You thrive on days off with focused bursts of productivity. Weekends are your power zone — consider whether a few weekday habits could balance your rhythm.",
    icon: Zap,
    gradient: "from-amber-500/20 to-orange-500/10",
    accentColor: "text-amber-400",
    borderColor: "border-amber-500/30",
  },
  night_owl: {
    label: "Night Owl",
    tagline: "Late-Night Achiever",
    description:
      "You get things done in the later hours. There's nothing wrong with being a night person — just make sure you're completing habits intentionally, not rushing at the last minute.",
    icon: Moon,
    gradient: "from-indigo-500/20 to-purple-500/10",
    accentColor: "text-indigo-400",
    borderColor: "border-indigo-500/30",
  },
  momentum_builder: {
    label: "Momentum Builder",
    tagline: "Rising Trajectory",
    description:
      "Your consistency varies day-to-day, but your overall trajectory is improving. You're building momentum — keep the trend going and the consistency will follow.",
    icon: TrendingUp,
    gradient: "from-sky-500/20 to-cyan-500/10",
    accentColor: "text-sky-400",
    borderColor: "border-sky-500/30",
  },
};

export default function ArchetypeCard() {
  const [data, setData] = useState<ArchetypeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArchetype = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/ml/archetype");
        if (!res.ok) throw new Error("Failed to load archetype");
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchArchetype();
  }, []);

  if (isLoading) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center p-6 rounded-xl border min-h-[200px]"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        <span className="text-xs text-slate-400 mt-2 font-medium">Analyzing behavioral patterns...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center p-6 rounded-xl border min-h-[200px] text-center"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <AlertCircle className="h-8 w-8 text-rose-500 mb-2" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Classification Offline</span>
        <p className="text-[10px] text-slate-500 mt-1">{error || "Failed to query pipeline"}</p>
      </div>
    );
  }

  // Insufficient data state
  if (data.archetype === "insufficient_data") {
    const completionProgress = Math.min(100, Math.round((data.confidence.completionsCount / 15) * 100));
    const ageProgress = Math.min(100, Math.round((data.confidence.accountAgeDays / 14) * 100));

    return (
      <div
        className="stat-card p-6 rounded-xl border flex flex-col gap-4"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5 border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: "rgba(56, 189, 248, 0.1)",
              borderColor: "rgba(56, 189, 248, 0.2)",
            }}
          >
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Behavioral Archetype</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Pattern Classifier v1</p>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 bg-slate-950/20 border border-slate-800/40 p-4 rounded-lg flex flex-col gap-2">
          <span className="font-bold text-slate-300">Building your behavioral profile...</span>
          <p className="text-slate-500 leading-snug">
            Requires at least 14 days of history and 15 timed completions to classify your pattern.
          </p>
          <div className="flex gap-4 mt-1">
            <div className="flex-1">
              <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                <span>Completions</span>
                <span>{data.confidence.completionsCount}/15</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500/60 rounded-full transition-all duration-500"
                  style={{ width: `${completionProgress}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                <span>Account Age</span>
                <span>{data.confidence.accountAgeDays}/14 days</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500/60 rounded-full transition-all duration-500"
                  style={{ width: `${ageProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active archetype display
  const meta = ARCHETYPE_META[data.archetype];
  if (!meta) return null;

  const IconComponent = meta.icon;

  return (
    <div
      className={`stat-card p-6 rounded-xl border flex flex-col gap-4 relative overflow-hidden transition-all duration-300 ${meta.borderColor}`}
      style={{ backgroundColor: "var(--bg-secondary)" }}
    >
      {/* Subtle gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} pointer-events-none`} />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${meta.borderColor}`}
            style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
          >
            <IconComponent className={`h-4 w-4 ${meta.accentColor}`} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Behavioral Archetype</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Pattern Classifier v{data.classifierVersion}</p>
          </div>
        </div>

        {/* Archetype Label */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h3 className={`text-xl font-black ${meta.accentColor} tracking-tight`}>
              {meta.label}
            </h3>
            <span
              className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${meta.borderColor} ${meta.accentColor}`}
              style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
            >
              {meta.tagline}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
            {meta.description}
          </p>
        </div>

        {/* Feature breakdown */}
        {data.features && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <FeatureStat label="Weekday Rate" value={`${Math.round(data.features.weekdayRate * 100)}%`} />
            <FeatureStat label="Weekend Rate" value={`${Math.round(data.features.weekendRate * 100)}%`} />
            <FeatureStat label="Night Ratio" value={`${Math.round(data.features.eveningNightRatio * 100)}%`} />
            <FeatureStat label="Volatility" value={`${Math.round(data.features.streakVolatility * 100)}%`} />
            <FeatureStat label="Late-Night" value={`${Math.round(data.features.lastMinuteRate)}%`} />
            <FeatureStat
              label="Momentum"
              value={data.features.momentumTrend > 0 ? "↑ Rising" : data.features.momentumTrend < 0 ? "↓ Falling" : "→ Stable"}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-1.5">
      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
      <span className="text-xs text-white font-extrabold mt-0.5">{value}</span>
    </div>
  );
}
