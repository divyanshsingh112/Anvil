"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useUserStore } from "@/store/useUserStore";
import { useLabels } from "@/hooks/useLabels";
import * as Icons from "lucide-react";
import { Coins, Flame, Award, Loader2, LogOut } from "lucide-react";
import React, { ComponentType } from "react";
import AvatarBuilder from "@/components/gamification/AvatarBuilder";
import ProcrastinationFingerprint from "@/components/dashboard/ProcrastinationFingerprint";
import ArchetypeCard from "@/components/dashboard/ArchetypeCard";
import MonthForecastWidget from "@/components/dashboard/MonthForecastWidget";

interface AchievementUI {
  id: string;
  key: string;
  name: string;
  description: string;
  xpReward: number;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export default function ProfilePage() {
  const {
    xp,
    level,
    coins,
    streak,
    longestStreak,
    warriorCompletions,
    mageCompletions,
    rogueCompletions,
    fetchUserStats,
  } = useUserStore();
  const labels = useLabels();
  const [achievements, setAchievements] = useState<AchievementUI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserStats();
    fetchAchievementsList();
  }, [fetchUserStats]);

  const fetchAchievementsList = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/achievements");
      if (!res.ok) {
        throw new Error("Failed to load achievements");
      }
      const data = await res.json();
      setAchievements(data);
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message);
    } finally {
      setIsLoading(false);
    }
  };

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <main
      className="min-h-screen py-10 px-4 max-w-6xl mx-auto"
      style={{ color: "var(--text-primary)" }}
    >
      {/* Profile Header */}
      <section
        className="rounded-2xl p-6 md:p-8 border shadow-lg relative overflow-hidden"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: "var(--accent-purple)" }}
        />

        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center relative z-10">
          {/* Layered Character Avatar */}
          <AvatarBuilder
            warriorCompletions={warriorCompletions}
            mageCompletions={mageCompletions}
            rogueCompletions={rogueCompletions}
            size={96}
          />

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h1 className="text-2xl font-black md:text-3xl text-white tracking-tight">
                  {labels.levelLabel} Profile
                </h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  {labels.levelLabel} {level} {labels.habitSingular} Champion
                </p>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="self-center sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>

            {/* Level XP Progress Bar */}
            <div className="mt-4 max-w-md mx-auto md:mx-0">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>{labels.xpLabel} Progress</span>
                <span>{xp % 100} / 100 {labels.xpLabel}</span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--bg-tertiary)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${xp % 100}%`,
                    backgroundColor: "var(--accent-purple)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* User Gamification Counters */}
          <div className="flex flex-wrap gap-4 justify-center">
             {/* Coins */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border min-w-[110px]"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
              }}
            >
              <Coins className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {labels.coinsLabel}
                </div>
                <div className="text-base font-extrabold text-yellow-400">
                  {coins}
                </div>
              </div>
            </div>

            {/* Streak */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border min-w-[110px]"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
              }}
            >
              <Flame className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  Current {labels.streakLabel}
                </div>
                <div className="text-base font-extrabold text-orange-400">
                  {streak} days
                </div>
              </div>
            </div>

            {/* Longest Streak */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border min-w-[110px]"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
              }}
            >
              <Award className="h-5 w-5 text-teal-500" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  Max {labels.streakLabel}
                </div>
                <div className="text-base font-extrabold text-teal-400">
                  {longestStreak} days
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ML Insights Section */}
      <div className="mt-8 flex flex-col gap-6">
        <MonthForecastWidget />
        <ArchetypeCard />
        <ProcrastinationFingerprint />
      </div>
 
       {/* Achievements Gallery */}
       <section className="mt-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-8">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-400" />
              Achievements Gallery
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Earn achievements to boost your {labels.levelLabel} {labels.xpLabel} and unlock prestige.
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-xs font-black"
            style={{
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              color: "#c084fc",
              border: "1px solid rgba(168, 85, 247, 0.3)",
            }}
          >
            Unlocked: {unlockedCount} / {achievements.length}
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl p-4 border text-sm text-center mb-6"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderColor: "rgba(239, 68, 68, 0.2)",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <span className="text-sm text-slate-400 font-semibold">
              Loading achievements...
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {achievements.map((ach) => {
              const IconComponent = (Icons as unknown as Record<string, ComponentType<{ className?: string }>>)[ach.icon] || Award;
              const isLocked = !ach.unlocked;

              return (
                <div
                  key={ach.id}
                  className="rounded-xl border p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: isLocked ? "var(--border)" : "var(--accent-purple)",
                    opacity: isLocked ? 0.55 : 1,
                    filter: isLocked ? "grayscale(40%)" : "none",
                    boxShadow: isLocked
                      ? "none"
                      : "0 4px 20px -2px rgba(168, 85, 247, 0.15)",
                  }}
                >
                  <div className="flex gap-4 items-start">
                    {/* Icon Container */}
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
                      style={{
                        backgroundColor: isLocked
                          ? "var(--bg-tertiary)"
                          : "rgba(168, 85, 247, 0.15)",
                        borderColor: isLocked
                          ? "var(--border)"
                          : "rgba(168, 85, 247, 0.3)",
                      }}
                    >
                      <IconComponent
                        className={`h-6 w-6 ${isLocked ? "text-slate-500" : "text-yellow-400"}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-extrabold text-white truncate">
                        {ach.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {ach.description}
                      </p>
                    </div>
                  </div>

                  {/* Footer details */}
                  <div
                    className="mt-6 pt-3 border-t flex justify-between items-center text-[10px] font-bold"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div>
                      {isLocked ? (
                        <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Icons.Lock className="h-3 w-3" /> Locked
                        </span>
                      ) : (
                        <span
                          className="uppercase tracking-wider flex items-center gap-1"
                          style={{ color: "var(--accent-teal)" }}
                        >
                          <Icons.Check className="h-3 w-3" /> Unlocked
                          {ach.unlockedAt && (
                            <span className="text-[9px] text-slate-500 normal-case font-normal ml-0.5">
                              on {new Date(ach.unlockedAt).toLocaleDateString()}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div
                      className="px-2 py-0.5 rounded text-[9px] font-black"
                      style={{
                        backgroundColor: isLocked
                          ? "var(--bg-tertiary)"
                          : "rgba(168, 85, 247, 0.2)",
                        color: isLocked ? "var(--text-muted)" : "#c084fc",
                      }}
                    >
                      +{ach.xpReward} XP
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
