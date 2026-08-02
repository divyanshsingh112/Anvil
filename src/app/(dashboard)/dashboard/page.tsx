"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Swords, Quote } from "lucide-react";
import WeeklyReportCard from "@/components/dashboard/WeeklyReportCard";
import ClassRadarChart from "@/components/dashboard/ClassRadarChart";
import ConsistencyTrendChart from "@/components/dashboard/ConsistencyTrendChart";
import MomentumWidget from "@/components/dashboard/MomentumWidget";
import { useLabels } from "@/hooks/useLabels";

interface YearSummary {
  year: number;
  totalCompletions: number;
}

export default function DashboardPage() {
  const labels = useLabels();
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
    <main className="relative min-h-screen px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-8 font-geist">
      {/* 3D Background Shaders & Ambient Glow Orbs */}
      <div className="fixed inset-0 -z-10 texture-bg opacity-30 pointer-events-none" />
      <div className="fixed top-20 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Page Header */}
      <div className="border-b border-slate-700/60 pb-6">
        <h1 className="font-sora text-3xl sm:text-4xl font-black tracking-tight text-white">
          {labels.habitSingular} Archive
        </h1>
        <p className="font-geist text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed max-w-3xl">
          Select a year to explore your {labels.habitSingular.toLowerCase()} journey and measure your progress through history.
        </p>
      </div>

      {/* Hero Section: Weekly Performance & Elite Status Banner */}
      <section>
        <WeeklyReportCard />
      </section>

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Main Column (Wide - 8 Cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Class / Habit Attributes Radar Chart */}
          <ClassRadarChart />

          {/* 6-Month Consistency Trend Chart */}
          <ConsistencyTrendChart />
        </div>

        {/* Right Sidebar Column (Narrow - 4 Cols) */}
        <div className="lg:col-span-4 space-y-8">
          {/* Momentum Gauge Widget with 3D Molten Anvil */}
          <MomentumWidget />

          {/* Year Cards Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-geist text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Explore Years
              </h3>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl p-4 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 font-medium">
                {error}
              </div>
            )}

            {/* Loading Spinner */}
            {isLoading ? (
              <div className="glass-card rounded-2xl p-8 flex justify-center items-center">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-purple-500" />
              </div>
            ) : years.length === 0 ? (
              /* Empty History State */
              <div className="glass-card flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/80 py-12 px-4 text-center">
                <Calendar className="h-10 w-10 text-slate-500 mb-3" />
                <p className="font-sora text-sm font-bold text-slate-300">
                  No {labels.habitSingular.toLowerCase()} history found
                </p>
                <p className="font-geist text-xs text-slate-500 mt-1">
                  Start by creating your first {labels.habitSingular.toLowerCase()}
                </p>
              </div>
            ) : (
              /* Year Cards List */
              <div className="space-y-4">
                {years.map((yearData) => {
                  const isCurrent = yearData.year === currentYear;
                  return (
                    <div
                      key={yearData.year}
                      onClick={() => handleYearClick(yearData.year)}
                      className={`group glass-card rounded-2xl p-6 border transition-all duration-300 cursor-pointer relative overflow-hidden ${
                        isCurrent
                          ? "border-purple-500/60 shadow-[0_0_25px_rgba(139,92,246,0.15)] hover:border-purple-400"
                          : "border-slate-800 hover:border-slate-600"
                      }`}
                    >
                      {/* Decorative Glow Orb */}
                      <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-purple-600/10 rounded-full blur-2xl group-hover:bg-purple-600/20 transition-colors pointer-events-none" />

                      <div className="flex items-center justify-between mb-3">
                        {isCurrent ? (
                          <span className="font-geist text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            Current
                          </span>
                        ) : (
                          <span className="font-geist text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Archive
                          </span>
                        )}
                        <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                      </div>

                      <h2 className="font-sora text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
                        {yearData.year}
                      </h2>

                      <div className="flex items-center gap-2 text-slate-300 font-geist text-xs font-semibold">
                        <Swords className="h-4 w-4 text-purple-400" />
                        <span>
                          {yearData.totalCompletions}{" "}
                          {yearData.totalCompletions === 1
                            ? `${labels.habitSingular.toLowerCase()} completed`
                            : `${labels.habitPlural.toLowerCase()} completed`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inspirational Quote Card */}
          <div className="glass-card rounded-2xl p-5 border border-dashed border-slate-700/80 text-center opacity-85 hover:opacity-100 transition-opacity">
            <Quote className="h-5 w-5 text-purple-400 mx-auto mb-2 opacity-60" />
            <p className="font-geist text-xs italic text-slate-300 leading-relaxed font-medium">
              &quot;Discipline is the bridge between goals and accomplishment.&quot;
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
