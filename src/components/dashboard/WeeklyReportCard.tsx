"use client";

import React, { useEffect, useState, ComponentType } from "react";
import { Loader2, Award, Zap, TrendingUp, RotateCcw, Trophy, AlertCircle } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";

const REPORT_ICONS: Record<string, ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Award,
  Zap,
  TrendingUp,
  RotateCcw,
  Trophy,
};

interface ReportCardData {
  tier: "elite" | "building" | "steady" | "reset";
  tierLabel: string;
  percentage: number;
  message: string;
  icon: string;
  color: string;
}

export default function WeeklyReportCard() {
  const labels = useLabels();
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReportCard();
  }, []);

  const fetchReportCard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/report-card");
      if (!res.ok) {
        throw new Error("Failed to load weekly report card");
      }
      const data = await res.json();
      setReport(data);
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6 border flex justify-center items-center gap-3 min-h-[160px]">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <span className="font-geist text-xs text-slate-400 font-bold uppercase tracking-wider">
          Analyzing weekly report...
        </span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="glass-card rounded-2xl p-6 border text-center flex flex-col justify-center items-center gap-2 min-h-[160px]">
        <AlertCircle className="h-6 w-6 text-rose-500" />
        <span className="font-geist text-xs text-slate-400 font-bold uppercase tracking-wider">
          Failed to fetch report card
        </span>
      </div>
    );
  }

  const IconComponent = REPORT_ICONS[report.icon] || Trophy;

  return (
    <div
      className="relative group overflow-hidden rounded-2xl p-6 border flex flex-col justify-between transition-all duration-300 hard-shadow glass-card hover:-translate-y-0.5"
      style={{
        borderColor: `${report.color}60`,
        boxShadow: `0 8px 32px -4px ${report.color}25, inset 0 0 15px ${report.color}10`,
      }}
    >
      {/* Animated Ambient 3D Glow Blob */}
      <div
        className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-3xl opacity-20 group-hover:opacity-35 transition-opacity pointer-events-none"
        style={{ backgroundColor: report.color }}
      />

      <div className="flex gap-5 items-start relative z-10">
        {/* 3D Tier Badge Container */}
        <div
          className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl flex items-center justify-center border shadow-lg transition-transform group-hover:scale-105"
          style={{
            backgroundColor: `${report.color}18`,
            borderColor: `${report.color}40`,
            boxShadow: `0 0 20px ${report.color}30`,
          }}
        >
          <IconComponent className="h-7 w-7 sm:h-8 sm:w-8 drop-shadow-md" style={{ color: report.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h2 className="font-sora text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {report.tierLabel}
            </h2>
            <span
              className="font-geist text-[11px] font-extrabold rounded-full px-3 py-1 uppercase tracking-wider shadow-sm"
              style={{
                backgroundColor: `${report.color}25`,
                color: report.color,
                border: `1px solid ${report.color}40`,
              }}
            >
              {report.percentage}% Complete
            </span>
          </div>
          <p className="font-geist text-xs sm:text-sm font-medium leading-relaxed text-slate-300 max-w-2xl mt-1">
            {report.message}
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-slate-700/60 flex justify-between items-center text-[10px] sm:text-xs font-bold font-geist">
        <span className="text-slate-400">
          Weekly {labels.habitSingular} Performance (Last 7 Days)
        </span>
        <span style={{ color: report.color }} className="font-semibold">
          Updates every Monday
        </span>
      </div>
    </div>
  );
}
