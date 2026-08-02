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
      <div className="glass-card rounded-2xl p-6 border flex flex-col items-center justify-center min-h-[320px]">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        <span className="font-geist text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">
          Loading trend data...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card rounded-2xl p-6 border flex flex-col items-center justify-center min-h-[320px]">
        <TrendingUp className="h-6 w-6 text-rose-500" />
        <span className="font-geist text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">
          Failed to load trend
        </span>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-700/60 min-h-[320px] transition-all duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 border border-teal-500/30 shadow-md">
          <TrendingUp className="h-4 w-4 text-teal-400" />
        </div>
        <div>
          <h3 className="font-geist text-xs font-extrabold uppercase tracking-widest text-slate-300">
            6-Month Consistency
          </h3>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="purpleTealGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{
              fill: "#94a3b8",
              fontSize: 11,
              fontWeight: 700,
            }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{
              fill: "#94a3b8",
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
                <div className="rounded-xl px-3 py-2 text-xs shadow-xl border bg-slate-900 border-purple-500/30">
                  <div className="font-bold text-white">
                    {point.label} {point.year}
                  </div>
                  <div className="font-black text-sm mt-0.5 text-purple-400">
                    {point.percentage}%
                  </div>
                  {!point.hadHabits && point.percentage === 0 && (
                    <div className="text-[10px] mt-1 italic text-slate-400">
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
            stroke="#8b5cf6"
            strokeWidth={3}
            fill="url(#purpleTealGradient)"
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Current Month Highlight */}
      {data.length > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/60 font-geist">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Current: {data[data.length - 1].label} {data[data.length - 1].year}
          </span>
          <span className="font-sora text-sm font-black text-purple-400">
            {data[data.length - 1].percentage}%
          </span>
        </div>
      )}
    </div>
  );
}
