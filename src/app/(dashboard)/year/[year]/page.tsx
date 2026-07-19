"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Breadcrumb from "@/components/shared/Breadcrumb";
import { ChevronRight, TrendingUp } from "lucide-react";

interface MonthStat {
  month: number;
  completions: number;
  totalPossible: number;
  rate: number;
  hasHabits: boolean;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function YearGridPage() {
  const params = useParams();
  const year = parseInt(params.year as string, 10);
  const router = useRouter();

  const [monthStats, setMonthStats] = useState<MonthStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  useEffect(() => {
    const fetchYearStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/habits/year-stats?year=${year}`);
        if (!res.ok) {
          throw new Error("Failed to fetch year stats");
        }
        const data = await res.json();
        setMonthStats(data);
      } catch (err) {
        const errorObj = err as Error;
        setError(errorObj.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isNaN(year)) {
      fetchYearStats();
    }
  }, [year]);

  const handleMonthClick = (month: number) => {
    router.push(`/year/${year}/month/${month}`);
  };

  if (isNaN(year)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--text-secondary)" }}>Invalid year</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <Breadcrumb
        segments={[{ label: String(year), href: `/year/${year}` }]}
      />

      {/* Header */}
      <div
        className="border-b pb-6"
        style={{ borderColor: "var(--border)" }}
      >
        <h1
          className="text-3xl font-extrabold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {year} Overview
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Monthly breakdown of your quest journey
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "var(--danger)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : (
        /* Month Cards Grid — always 12 */
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {monthStats.map((ms) => {
            const isCurrent =
              year === currentYear && ms.month === currentMonth;
            const isEmpty = !ms.hasHabits;

            return (
              <div
                key={ms.month}
                className={`month-card group ${isEmpty ? "month-card--empty" : ""} ${
                  isCurrent ? "month-card--current" : ""
                }`}
                onClick={() => handleMonthClick(ms.month)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{
                      color: isEmpty
                        ? "var(--text-muted)"
                        : "var(--text-primary)",
                    }}
                  >
                    {MONTH_NAMES[ms.month - 1]}
                  </h3>
                  <ChevronRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--text-muted)" }}
                  />
                </div>

                {isEmpty ? (
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No quests yet
                  </p>
                ) : (
                  <>
                    <div
                      className="text-2xl font-black"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {ms.rate}%
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <TrendingUp
                        className="h-3 w-3"
                        style={{
                          color:
                            ms.rate >= 70
                              ? "var(--success)"
                              : ms.rate >= 40
                              ? "var(--warning)"
                              : "var(--danger)",
                        }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {ms.completions} completed
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    <div className="mt-3">
                      <div className="progress-bar">
                        <div
                          className="progress-bar__fill"
                          style={{ width: `${ms.rate}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {isCurrent && (
                  <div className="mt-2">
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: "rgba(13, 148, 136, 0.2)",
                        color: "var(--accent-teal)",
                        border: "1px solid rgba(13, 148, 136, 0.3)",
                      }}
                    >
                      Current
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
