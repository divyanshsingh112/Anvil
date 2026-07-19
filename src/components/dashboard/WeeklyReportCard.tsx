"use client";

import { useEffect, useState, ComponentType } from "react";
import * as Icons from "lucide-react";
import { Loader2, Award } from "lucide-react";

interface ReportCardData {
  tier: "elite" | "building" | "steady" | "reset";
  tierLabel: string;
  percentage: number;
  message: string;
  icon: string;
  color: string;
}

export default function WeeklyReportCard() {
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
      <div
        className="rounded-2xl p-6 border flex justify-center items-center gap-3 h-40"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          Analyzing weekly report...
        </span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div
        className="rounded-2xl p-6 border text-center flex flex-col justify-center items-center gap-2 h-40"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <Icons.AlertCircle className="h-6 w-6 text-red-500" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
          Failed to fetch report card
        </span>
      </div>
    );
  }

  const IconComponent = (Icons as Record<string, ComponentType<{ className?: string }>>)[report.icon] || Award;

  return (
    <div
      className="rounded-2xl p-6 border relative overflow-hidden flex flex-col justify-between shadow-lg min-h-[160px] transition-all duration-300"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: report.color,
        boxShadow: `0 4px 20px -4px ${report.color}1c`,
      }}
    >
      {/* Subtle Background Glow */}
      <div
        className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-3xl opacity-10"
        style={{ backgroundColor: report.color }}
      />

      <div className="flex gap-4 items-start relative z-10">
        {/* Tier Icon */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
          style={{
            backgroundColor: `${report.color}15`,
            borderColor: `${report.color}35`,
          }}
        >
          <IconComponent className="h-6 w-6" style={{ color: report.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-extrabold text-white tracking-tight">
              {report.tierLabel}
            </h3>
            <span
              className="text-xs font-black rounded-full px-2.5 py-0.5"
              style={{
                backgroundColor: `${report.color}20`,
                color: report.color,
              }}
            >
              {report.percentage}% Complete
            </span>
          </div>
          <p
            className="text-xs font-medium leading-relaxed mt-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {report.message}
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div
        className="mt-6 pt-3 border-t flex justify-between items-center text-[10px] font-bold"
        style={{ borderColor: "var(--border)" }}
      >
        <span style={{ color: "var(--text-muted)" }}>
          Weekly Quest Performance (Last 7 Days)
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          Updates every Monday
        </span>
      </div>
    </div>
  );
}
