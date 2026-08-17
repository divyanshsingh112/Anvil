"use client";

import { ComponentType } from "react";
import {
  Trophy,
  Flame,
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
} from "lucide-react";

const ACHIEVEMENT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
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

interface Achievement {
  key: string;
  name: string;
  xpReward: number;
  icon: string;
}

interface AchievementToastProps {
  achievements: Achievement[];
  onClose: () => void;
}

export default function AchievementToast({ achievements, onClose }: AchievementToastProps) {
  if (achievements.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-300 animate-in fade-in"
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 text-center border shadow-2xl relative overflow-hidden"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        {/* Glow effect */}
        <div
          className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: "var(--accent-purple)" }}
        />
        <div
          className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: "var(--accent-teal)" }}
        />

        {/* Floating star/trophy decoration */}
        <div className="flex justify-center mb-6 relative">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full border shadow-lg animate-bounce"
            style={{
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              borderColor: "var(--accent-purple)",
            }}
          >
            <Trophy className="h-10 w-10 text-yellow-400" />
          </div>
        </div>

        <h3 className="text-2xl font-black text-white tracking-tight">
          Achievements Unlocked!
        </h3>
        <p className="text-sm mt-1 text-slate-400">
          You earned rewards for your legendary actions!
        </p>

        {/* Achievement list */}
        <div className="mt-6 flex flex-col gap-3 max-h-60 overflow-y-auto px-2">
          {achievements.map((ach) => {
            const IconComponent = ACHIEVEMENT_ICONS[ach.icon] || Award;

            return (
              <div
                key={ach.key}
                className="flex items-center gap-4 rounded-xl p-3 border"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    backgroundColor: "rgba(234, 179, 8, 0.1)",
                    borderColor: "rgba(234, 179, 8, 0.3)",
                  }}
                >
                  <IconComponent className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">
                    {ach.name}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Reward Claimed:
                  </p>
                </div>
                <div
                  className="rounded-full px-2.5 py-1 text-xs font-black"
                  style={{
                    backgroundColor: "rgba(168, 85, 247, 0.2)",
                    color: "#c084fc",
                  }}
                >
                  +{ach.xpReward} XP
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="mt-8">
          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm font-black text-white tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            style={{
              backgroundColor: "var(--accent-purple)",
            }}
          >
            AWESOME!
          </button>
        </div>
      </div>
    </div>
  );
}
