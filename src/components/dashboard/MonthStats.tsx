"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import { Target, Flame, Swords } from "lucide-react";

interface MonthStatsProps {
  year: number;
  month: number;
}

interface StatsData {
  completions: number;
  totalPossible: number;
  successRate: number;
  habitCount: number;
}

export default function MonthStats({ year, month }: MonthStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { streak } = useUserStore();

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/completions/month-stats?year=${year}&month=${month}`
        );
        if (res.ok) {
          const json = await res.json();
          setStats(json);
        }
      } catch (err) {
        console.error("Failed to fetch month stats:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [year, month]);

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="stat-card animate-pulse"
          >
            <div className="h-16" />
          </div>
        ))}
      </div>
    );
  }

  const progressPercent =
    stats.totalPossible > 0
      ? Math.round((stats.completions / stats.totalPossible) * 100)
      : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Success Rate */}
      <div className="stat-card stat-card--rate">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "rgba(13, 148, 136, 0.15)",
              border: "1px solid rgba(13, 148, 136, 0.3)",
            }}
          >
            <Target className="h-4 w-4" style={{ color: "var(--accent-teal)" }} />
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Success Rate
          </span>
        </div>
        <div className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
          {stats.successRate}%
        </div>
        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
          {stats.completions} of {stats.totalPossible} possible
        </p>
      </div>

      {/* Current Streak */}
      <div className="stat-card stat-card--streak">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            <Flame className="h-4 w-4" style={{ color: "var(--accent-gold)" }} />
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Current Streak
          </span>
        </div>
        <div className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
          {streak} <span className="text-base font-semibold" style={{ color: "var(--text-secondary)" }}>days</span>
        </div>
        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
          {streak > 0 ? "Keep the flame alive!" : "Complete all quests today to start"}
        </p>
      </div>

      {/* Quests Completed */}
      <div className="stat-card stat-card--quests">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "rgba(124, 58, 237, 0.15)",
              border: "1px solid rgba(124, 58, 237, 0.3)",
            }}
          >
            <Swords className="h-4 w-4" style={{ color: "var(--accent-purple)" }} />
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Quests Completed
          </span>
        </div>
        <div className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
          {stats.completions}
        </div>
        <div className="mt-2">
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
            {progressPercent}% of monthly goal
          </p>
        </div>
      </div>
    </div>
  );
}
