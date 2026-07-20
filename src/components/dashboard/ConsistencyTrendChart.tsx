"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, TrendingUp } from "lucide-react";

interface TrendPoint {
  month: number;
  year: number;
  label: string;
  percentage: number;
  hadHabits: boolean;
}

export default function ConsistencyTrendChart() {
  const [data, setData] = useState<TrendPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrend();
  }, []);

  const fetchTrend = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/consistency-trend");
      if (!res.ok) throw new Error("Failed to load trend data");
      const trend: TrendPoint[] = await res.json();
      setData(trend);
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
        className="stat-card flex flex-col items-center justify-center"
        style={{ minHeight: "320px" }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
          Loading trend data...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center"
        style={{ minHeight: "320px" }}
      >
        <TrendingUp className="h-6 w-6 text-red-500" />
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
          Failed to load trend
        </span>
      </div>
    );
  }

  return (
    <div className="stat-card" style={{ minHeight: "320px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "rgba(13, 148, 136, 0.15)",
            border: "1px solid rgba(13, 148, 136, 0.3)",
          }}
        >
          <TrendingUp className="h-4 w-4" style={{ color: "var(--accent-teal)" }} />
        </div>
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            6-Month Consistency
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{
              fill: "var(--text-muted)",
              fontSize: 11,
              fontWeight: 600,
            }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{
              fill: "var(--text-muted)",
              fontSize: 10,
              fontWeight: 600,
            }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0].payload as TrendPoint;
              return (
                <div
                  className="rounded-lg px-3 py-2 text-xs shadow-lg border"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="font-bold" style={{ color: "var(--text-primary)" }}>
                    {point.label} {point.year}
                  </div>
                  <div
                    className="font-extrabold text-sm mt-0.5"
                    style={{ color: "var(--accent-teal)" }}
                  >
                    {point.percentage}%
                  </div>
                  {!point.hadHabits && point.percentage === 0 && (
                    <div
                      className="text-[10px] mt-1 italic"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No habits existed
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="percentage"
            stroke="var(--accent-teal)"
            strokeWidth={2.5}
            fill="url(#tealGradient)"
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Current Month Highlight */}
      {data.length > 0 && (
        <div className="flex items-center justify-between mt-1">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Current: {data[data.length - 1].label} {data[data.length - 1].year}
          </span>
          <span
            className="text-xs font-extrabold"
            style={{ color: "var(--accent-teal)" }}
          >
            {data[data.length - 1].percentage}%
          </span>
        </div>
      )}
    </div>
  );
}
