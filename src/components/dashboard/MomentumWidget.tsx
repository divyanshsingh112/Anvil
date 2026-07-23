"use client";

import { useEffect, useState } from "react";
import { Flame, TrendingUp, AlertTriangle, AlertOctagon, Snowflake, Shield, Trophy } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";

interface MomentumResponse {
  score: number;
  tier: "on-fire" | "building" | "slipping" | "fading" | "cold";
  label: string;
  intervention: {
    type: "celebrate" | "encourage" | "challenge" | "rival" | "warning" | "freeze";
    message: string;
    details: any;
  };
  breakdown: {
    trend: number;
    streak: number;
    login: number;
    consistency: number;
    best7: number;
  };
}

export default function MomentumWidget() {
  const labels = useLabels();
  const [data, setData] = useState<MomentumResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMomentum = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/user/momentum");
        if (!res.ok) throw new Error("Failed to load momentum data");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMomentum();
  }, []);

  if (isLoading) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center p-6 rounded-xl border min-h-[300px]"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        <span className="text-xs text-slate-400 mt-2 font-medium">Calculating momentum...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center p-6 rounded-xl border min-h-[300px] text-center"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Momentum Calculation Error</span>
        <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">{error || "Failed to load"}</p>
      </div>
    );
  }

  const { score, tier, intervention } = data;

  // Determine Badge colors & Icons
  let badgeColor = "var(--text-muted)";
  let badgeBg = "rgba(255, 255, 255, 0.05)";
  let progressColor = "var(--accent-purple)";
  let Icon = TrendingUp;

  if (tier === "on-fire") {
    badgeColor = "#ef4444"; // red
    badgeBg = "rgba(239, 68, 68, 0.15)";
    progressColor = "#f97316"; // orange
    Icon = Flame;
  } else if (tier === "building") {
    badgeColor = "#10b981"; // emerald
    badgeBg = "rgba(16, 185, 129, 0.15)";
    progressColor = "#10b981";
    Icon = TrendingUp;
  } else if (tier === "slipping") {
    badgeColor = "#f59e0b"; // amber
    badgeBg = "rgba(245, 158, 11, 0.15)";
    progressColor = "#f59e0b";
    Icon = AlertTriangle;
  } else if (tier === "fading") {
    badgeColor = "#f97316"; // orange
    badgeBg = "rgba(249, 115, 22, 0.15)";
    progressColor = "#f97316";
    Icon = AlertTriangle;
  } else if (tier === "cold") {
    badgeColor = "#3b82f6"; // blue
    badgeBg = "rgba(59, 130, 246, 0.15)";
    progressColor = "#3b82f6";
    Icon = Snowflake;
  }

  // Translating Slipping Challenge copy via useLabels()
  let interventionMessage = intervention.message;
  if (intervention.type === "challenge" && intervention.details?.weakestClass) {
    const wClass = intervention.details.weakestClass;
    const classLabel = wClass === "warrior" ? labels.classWarrior
                     : wClass === "mage" ? labels.classMage
                     : labels.classRogue;
    interventionMessage = `Your ${classLabel.toLowerCase()} ${labels.habitPlural.toLowerCase()} have been slipping — complete one today to recover momentum!`;
  }

  return (
    <div
      className="stat-card p-5 rounded-xl border flex flex-col justify-between min-h-[320px] relative overflow-hidden"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Title */}
      <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: progressColor }} />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">Momentum</h2>
        </div>
        <span
          className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border"
          style={{
            color: badgeColor,
            backgroundColor: badgeBg,
            borderColor: badgeColor + "33",
          }}
        >
          {data.label}
        </span>
      </div>

      {/* Main Score Area */}
      <div className="flex flex-col items-center gap-2 flex-1 justify-center my-2">
        <div className="relative flex items-center justify-center h-24 w-24 rounded-full border-4" style={{ borderColor: "var(--border)" }}>
          {/* Radial progress ring simulator */}
          <div
            className="absolute inset-0 rounded-full border-4 transition-all duration-500"
            style={{
              borderColor: progressColor,
              clipPath: `polygon(50% 50%, 50% 0%, ${score >= 25 ? "100% 0%," : ""} ${score >= 50 ? "100% 100%," : ""} ${score >= 75 ? "0% 100%," : ""} ${score >= 100 ? "0% 0%," : ""} 50% 0%)`,
              opacity: 0.8,
            }}
          />
          <div className="flex flex-col items-center z-10">
            <span className="text-3xl font-black text-white leading-none">{Math.round(score)}</span>
            <span className="text-[8px] text-slate-500 font-extrabold uppercase mt-1">Score</span>
          </div>
        </div>
      </div>

      {/* Intervention Prompt Card */}
      <div
        className="rounded-lg border p-3 mt-2 flex items-start gap-3 transition-all duration-300"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          borderColor: "var(--border)",
        }}
      >
        {intervention.type === "celebrate" && <Trophy className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />}
        {intervention.type === "encourage" && <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}
        {intervention.type === "challenge" && <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
        {intervention.type === "rival" && <Shield className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />}
        {intervention.type === "warning" && <AlertOctagon className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />}
        {intervention.type === "freeze" && <Snowflake className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />}

        <div className="flex-1">
          <h4 className="text-[10px] font-black text-white uppercase tracking-wider leading-none mb-1">
            {intervention.type === "celebrate" ? "Trophy Unlocked" :
             intervention.type === "encourage" ? "Keep It Up" :
             intervention.type === "challenge" ? "Momentum Challenge" :
             intervention.type === "rival" ? "Rival Warning" :
             intervention.type === "warning" ? "Attention" : "Streak Protected"}
          </h4>
          <p className="text-[10px] text-slate-300 leading-snug font-semibold">{interventionMessage}</p>
        </div>
      </div>
    </div>
  );
}
