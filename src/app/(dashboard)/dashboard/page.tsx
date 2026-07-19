"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Swords } from "lucide-react";

interface YearSummary {
  year: number;
  totalCompletions: number;
}

export default function DashboardPage() {
  const [years, setYears] = useState<YearSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchYears = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/habits/years");
        if (!res.ok) {
          throw new Error("Failed to fetch years");
        }
        const data = await res.json();
        setYears(data);
      } catch (err) {
        const errorObj = err as Error;
        setError(errorObj.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchYears();
  }, []);

  const handleYearClick = (year: number) => {
    router.push(`/year/${year}`);
  };

  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b pb-6" style={{ borderColor: "var(--border)" }}>
        <h1
          className="text-3xl font-extrabold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Quest Archive
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Select a year to explore your habit journey
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
      ) : years.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 px-4 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <Calendar
            className="h-12 w-12 mb-4"
            style={{ color: "var(--text-muted)" }}
          />
          <p
            className="text-lg font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            No quest history found
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Start by creating your first habit
          </p>
        </div>
      ) : (
        /* Year Cards Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {years.map((yearData) => {
            const isCurrent = yearData.year === currentYear;
            return (
              <div
                key={yearData.year}
                className="year-card group"
                onClick={() => handleYearClick(yearData.year)}
                style={
                  isCurrent
                    ? {
                        borderColor: "var(--accent-purple)",
                        background:
                          "linear-gradient(135deg, var(--bg-secondary) 0%, rgba(124, 58, 237, 0.08) 100%)",
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {isCurrent && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "rgba(124, 58, 237, 0.2)",
                            color: "var(--accent-purple)",
                            border: "1px solid rgba(124, 58, 237, 0.3)",
                          }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                    <h2
                      className="text-4xl font-black tracking-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {yearData.year}
                    </h2>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 transition-transform group-hover:translate-x-1"
                    style={{ color: "var(--text-muted)" }}
                  />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Swords
                    className="h-4 w-4"
                    style={{ color: "var(--accent-purple)" }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {yearData.totalCompletions}{" "}
                    {yearData.totalCompletions === 1
                      ? "quest completed"
                      : "quests completed"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
