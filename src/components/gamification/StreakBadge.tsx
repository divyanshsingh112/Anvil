"use client";

import { useUserStore } from "@/store/useUserStore";
import { Flame, Shield, Snowflake } from "lucide-react";

export default function StreakBadge() {
  const streak = useUserStore((state) => state.streak);
  const streakShieldActive = useUserStore((state) => state.streakShieldActive);
  const freezeActiveDate = useUserStore((state) => state.freezeActiveDate);

  // Check if freeze is active for today in local timezone
  const isProtectedToday = (() => {
    if (!freezeActiveDate) return false;
    const freezeDate = new Date(freezeActiveDate);
    const today = new Date();
    return (
      freezeDate.getFullYear() === today.getFullYear() &&
      freezeDate.getMonth() === today.getMonth() &&
      freezeDate.getDate() === today.getDate()
    );
  })();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-950/40 border border-orange-800">
          <Flame className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Streak
          </div>
          <div className="text-xl font-black text-white flex items-center gap-1.5">
            {streak} {streak === 1 ? "day" : "days"}
          </div>
          <div className="text-[10px] text-orange-300 font-semibold">
            Active Run
          </div>
        </div>
      </div>

      {/* Badges Container */}
      <div className="flex flex-wrap gap-1.5 mt-1">
        {streakShieldActive && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1"
            style={{
              backgroundColor: "rgba(30, 64, 175, 0.2)",
              color: "#60a5fa",
              border: "1px solid rgba(30, 64, 175, 0.4)",
            }}
            title="Auto-Streak Shield unlocked (at 30 days). Protects 1 miss/month."
          >
            <Shield className="h-3 w-3" />
            Shield Active
          </span>
        )}

        {isProtectedToday && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1"
            style={{
              backgroundColor: "rgba(14, 116, 144, 0.2)",
              color: "#22d3ee",
              border: "1px solid rgba(14, 116, 144, 0.4)",
            }}
            title="Streak Freeze active for today. Your streak won't break if you miss today."
          >
            <Snowflake className="h-3 w-3 animate-pulse" />
            Protected
          </span>
        )}
      </div>
    </div>
  );
}
