"use client";

import { useEffect, useState, useRef, ComponentType } from "react";
import { signOut } from "next-auth/react";
import { useUserStore } from "@/store/useUserStore";
import { useLabels } from "@/hooks/useLabels";
import { getAvatarSrc } from "@/lib/avatar-helper";
import {
  Coins,
  Flame,
  Award,
  Loader2,
  LogOut,
  Trophy,
  Shield,
  Sparkles,
  Crown,
  Swords,
  CalendarCheck,
  Link,
  Sword,
  Zap,
  ShieldAlert,
  Lock,
  Check,
  Camera,
  AlertCircle,
} from "lucide-react";
import AvatarBuilder from "@/components/gamification/AvatarBuilder";
import ProcrastinationFingerprint from "@/components/dashboard/ProcrastinationFingerprint";
import ArchetypeCard from "@/components/dashboard/ArchetypeCard";
import MonthForecastWidget from "@/components/dashboard/MonthForecastWidget";

const PROFILE_ACHIEVEMENT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Flame,
  Trophy,
  Shield,
  Sparkles,
  Crown,
  Swords,
  CalendarCheck,
  Link,
  Award,
  Sword,
  Zap,
  ShieldAlert,
};

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserStats();
    fetchAchievementsList();
    fetchProfileSettings();
  }, [fetchUserStats]);

  const fetchProfileSettings = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl || null);
        setGender(data.gender || null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload avatar");
      }

      setAvatarUrl(data.avatarUrl);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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

  // Level XP progress derived from calculateLevel: level = Math.floor(Math.sqrt(xp / 100)) + 1
  const currentLevelBaseXp = Math.pow(level - 1, 2) * 100;
  const nextLevelBaseXp = Math.pow(level, 2) * 100;
  const xpInCurrentLevel = Math.max(0, xp - currentLevelBaseXp);
  const xpNeededForLevel = Math.max(1, nextLevelBaseXp - currentLevelBaseXp);
  const levelProgressPercent = Math.min(
    100,
    Math.max(0, Math.round((xpInCurrentLevel / xpNeededForLevel) * 100))
  );

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
          {/* Layered Character Avatar / Custom Avatar Upload */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-purple-500/40 bg-slate-950/60 flex items-center justify-center shadow-lg">
              {isUploadingAvatar ? (
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              ) : (
                <img
                  src={getAvatarSrc(avatarUrl, gender)}
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1 -right-1 p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-xl transition border border-slate-900 cursor-pointer disabled:opacity-50"
              title="Change profile picture"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h1 className="text-2xl font-black md:text-3xl text-white tracking-tight">
                  {labels.levelLabel} Profile
                </h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  {labels.levelLabel} {level} {labels.habitSingular} Champion
                </p>
                {uploadError && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{uploadError}</span>
                  </p>
                )}
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
                <span>{xpInCurrentLevel} / {xpNeededForLevel} {labels.xpLabel}</span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--bg-tertiary)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${levelProgressPercent}%`,
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
                  {streak} {streak === 1 ? "day" : "days"}
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
                  {longestStreak} {longestStreak === 1 ? "day" : "days"}
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
              const IconComponent = PROFILE_ACHIEVEMENT_ICONS[ach.icon] || Award;
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
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      ) : (
                        <span
                          className="uppercase tracking-wider flex items-center gap-1"
                          style={{ color: "var(--accent-teal)" }}
                        >
                          <Check className="h-3 w-3" /> Unlocked
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
