"use client";

import { useEffect, useState } from "react";
import { Flame, TrendingUp, AlertTriangle, AlertOctagon, Snowflake, Shield, Trophy, Zap } from "lucide-react";
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
      <div className="glass-card p-6 rounded-2xl border flex flex-col items-center justify-center min-h-[340px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        <span className="font-geist text-xs text-slate-400 mt-3 font-semibold uppercase tracking-wider">Calculating momentum...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card p-6 rounded-2xl border flex flex-col items-center justify-center min-h-[340px] text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
        <span className="font-geist text-xs text-slate-400 font-bold uppercase tracking-wider">Momentum Calculation Error</span>
        <p className="font-geist text-[10px] text-slate-500 mt-1 max-w-[200px]">{error || "Failed to load"}</p>
      </div>
    );
  }

  const { score, tier, intervention } = data;

  // Determine Badge colors & Icons
  let badgeColor = "#8b5cf6";
  let badgeBg = "rgba(139, 92, 246, 0.15)";
  let progressColor = "#8b5cf6";
  let Icon = Zap;

  if (tier === "on-fire") {
    badgeColor = "#ef4444";
    badgeBg = "rgba(239, 68, 68, 0.15)";
    progressColor = "#f97316";
    Icon = Flame;
  } else if (tier === "building") {
    badgeColor = "#10b981";
    badgeBg = "rgba(16, 185, 129, 0.15)";
    progressColor = "#10b981";
    Icon = TrendingUp;
  } else if (tier === "slipping") {
    badgeColor = "#f59e0b";
    badgeBg = "rgba(245, 158, 11, 0.15)";
    progressColor = "#f59e0b";
    Icon = AlertTriangle;
  } else if (tier === "fading") {
    badgeColor = "#f97316";
    badgeBg = "rgba(249, 115, 22, 0.15)";
    progressColor = "#f97316";
    Icon = AlertTriangle;
  } else if (tier === "cold") {
    badgeColor = "#3b82f6";
    badgeBg = "rgba(59, 130, 246, 0.15)";
    progressColor = "#3b82f6";
    Icon = Snowflake;
  }

  let interventionMessage = intervention.message;
  if (intervention.type === "challenge" && intervention.details?.weakestClass) {
    const wClass = intervention.details.weakestClass;
    const classLabel = wClass === "warrior" ? labels.classWarrior
                     : wClass === "mage" ? labels.classMage
                     : labels.classRogue;
    interventionMessage = `Your ${classLabel.toLowerCase()} ${labels.habitPlural.toLowerCase()} have been slipping — complete one today to recover momentum!`;
  }

  return (
    <div className="glass-card p-6 rounded-2xl border flex flex-col justify-between min-h-[340px] relative overflow-hidden group">
      {/* Background Ambient Pulse */}
      <div
        className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-35"
        style={{ backgroundColor: progressColor }}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 drop-shadow-md" style={{ color: progressColor }} />
          <h3 className="font-geist text-xs font-extrabold text-slate-300 uppercase tracking-widest">
            Momentum
          </h3>
        </div>
        <span
          className="font-geist text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm"
          style={{
            color: badgeColor,
            backgroundColor: badgeBg,
            borderColor: `${badgeColor}40`,
          }}
        >
          {data.label}
        </span>
      </div>

      {/* 3D Molten Anvil Gauge Centerpiece */}
      <div className="flex flex-col items-center py-4 my-auto relative">
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* Floating Animation Wrapper */}
          <div className="relative w-full h-full flex items-center justify-center animate-[float-slow_4s_ease-in-out_infinite]">
            {/* 3D Molten Anvil Asset */}
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvK78w-NAS8rPR_QjyacNZgPEm0c0Xu0puBhPhK6rD7XdnJQCiKTzCKKFjZFPeGmEvjGOQdmKUlS7MwRgkPB34_xUFxpsYJaz82QWTTVECUTdvUqV-CurTyEf8I4VYzuEtc0bii8qjPx2o-BafwqQfCHkRfptHEVHn9UKeXl9UznwT4OhuYBF03XWL-GrfzM7KUH86F2TBpojZVuHMpHYhmeIzSwZP9URgbcKQ5Ads6iVKe1meBEwHzg"
              alt="3D Molten Anvil"
              className="w-44 h-44 object-contain drop-shadow-[0_0_25px_rgba(139,92,246,0.45)] transition-transform duration-300 group-hover:scale-105"
            />
            {/* Overlay Score Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-sora text-4xl sm:text-5xl font-black text-white leading-none mt-8 drop-shadow-lg">
                {Math.round(score)}
              </span>
              <span className="font-geist text-[10px] font-extrabold text-slate-300 uppercase tracking-widest mt-1">
                Score
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Intervention Prompt Sub-Card */}
      <div className="mt-4 bg-slate-900/70 border border-slate-800 p-4 rounded-xl flex items-start gap-3.5 shadow-inner">
        <div className="p-2 bg-purple-500/10 rounded-lg shrink-0 border border-purple-500/20">
          {intervention.type === "celebrate" && <Trophy className="h-4 w-4 text-yellow-400" />}
          {intervention.type === "encourage" && <TrendingUp className="h-4 w-4 text-emerald-400" />}
          {intervention.type === "challenge" && <AlertTriangle className="h-4 w-4 text-amber-400" />}
          {intervention.type === "rival" && <Shield className="h-4 w-4 text-purple-400" />}
          {intervention.type === "warning" && <AlertOctagon className="h-4 w-4 text-orange-400" />}
          {intervention.type === "freeze" && <Snowflake className="h-4 w-4 text-blue-400" />}
        </div>
        <div>
          <h4 className="font-geist text-xs font-bold text-white uppercase tracking-wider mb-0.5">
            {intervention.type === "celebrate" ? "Trophy Unlocked" :
             intervention.type === "encourage" ? "Keep It Up" :
             intervention.type === "challenge" ? "Momentum Challenge" :
             intervention.type === "rival" ? "Rival Warning" :
             intervention.type === "warning" ? "Attention" : "Streak Protected"}
          </h4>
          <p className="font-geist text-xs text-slate-300 leading-relaxed font-medium">
            {interventionMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
