"use client";

import { useEffect, useState } from "react";
import { TrendingUp, AlertCircle, Calendar } from "lucide-react";

interface MonthForecastResponse {
  year: number;
  month: number;
  daysElapsed: number;
  daysRemaining: number;
  currentRatePercentage: number;
  projectedRatePercentage: number;
  confidenceBand: [number, number];
  confidenceLevel: "high" | "medium" | "low";
  momentumSlope: number;
  completionsToDate: number;
  totalPossibleToDate: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function MonthForecastWidget() {
  const [data, setData] = useState<MonthForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/completions/month-forecast");
        if (!res.ok) throw new Error("Failed to load month forecast");
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchForecast();
  }, []);

  if (isLoading) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center p-6 rounded-xl border min-h-[160px]"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        <span className="text-xs text-slate-400 mt-2 font-medium">Calculating forecast trajectory...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center p-6 rounded-xl border min-h-[160px] text-center"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <AlertCircle className="h-8 w-8 text-rose-500 mb-2" />
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Forecast Unavailable</span>
        <p className="text-[10px] text-slate-500 mt-1">{error || "Failed to query forecast"}</p>
      </div>
    );
  }

  const monthName = MONTH_NAMES[data.month - 1] || "Current Month";
  const isRising = data.momentumSlope > 0;
  const isFalling = data.momentumSlope < 0;

  return (
    <div
      className="stat-card p-6 rounded-xl border flex flex-col gap-4 relative overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              borderColor: "rgba(16, 185, 129, 0.2)",
            }}
          >
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider">{monthName} Month Forecast</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Statistical Trajectory Projection</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-slate-800 bg-slate-950 text-slate-400">
          <Calendar className="h-3 w-3 text-emerald-400" />
          <span>{data.daysRemaining} days remaining</span>
        </div>
      </div>

      {/* Main Forecast Body */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Projected Month-End Success Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400 tracking-tight">
              {data.projectedRatePercentage}%
            </span>
            <span className="text-xs font-bold text-slate-400">
              [{data.confidenceBand[0]}% - {data.confidenceBand[1]}%] band
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-1">
            Current pace: <span className="text-white font-bold">{data.currentRatePercentage}%</span> ({data.completionsToDate}/{data.totalPossibleToDate} slots).{" "}
            {isRising && "Trajectory is trending upward due to rising momentum."}
            {isFalling && "Trajectory reflects recent momentum deceleration."}
            {!isRising && !isFalling && "Trajectory remains steady."}
          </p>
        </div>

        {/* Confidence Level Badge */}
        <div className="flex flex-col items-end justify-center shrink-0 border-l pl-4 border-slate-800/80">
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Confidence</span>
          <span className="text-xs font-black uppercase text-emerald-300 mt-0.5">
            {data.confidenceLevel}
          </span>
          <span className="text-[8px] text-slate-500 font-medium">
            (±{data.confidenceBand[1] - data.projectedRatePercentage}%)
          </span>
        </div>
      </div>
    </div>
  );
}
