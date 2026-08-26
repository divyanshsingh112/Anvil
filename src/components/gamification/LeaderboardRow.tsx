"use client";

import { Crown, Medal } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";
import { getAvatarSrc } from "@/lib/avatar-helper";

interface LeaderboardUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  gender?: string | null;
  level: number;
  xp: number;
  rank: number;
}

interface LeaderboardRowProps {
  user: LeaderboardUser;
  isCurrentUser: boolean;
}

export default function LeaderboardRow({ user, isCurrentUser }: LeaderboardRowProps) {
  const labels = useLabels();
  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return <Crown className="h-5 w-5" style={{ color: "#fbbf24" }} />; // Gold Crown
    }
    if (rank === 2) {
      return <Medal className="h-5 w-5" style={{ color: "#94a3b8" }} />; // Silver Medal
    }
    if (rank === 3) {
      return <Medal className="h-5 w-5" style={{ color: "#b45309" }} />; // Bronze Medal
    }
    return <span className="text-xs font-bold text-slate-400">#{rank}</span>;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) {
      return {
        backgroundColor: "rgba(251, 191, 36, 0.1)",
        borderColor: "rgba(251, 191, 36, 0.3)",
      };
    }
    if (rank === 2) {
      return {
        backgroundColor: "rgba(148, 163, 184, 0.1)",
        borderColor: "rgba(148, 163, 184, 0.2)",
      };
    }
    if (rank === 3) {
      return {
        backgroundColor: "rgba(180, 83, 9, 0.1)",
        borderColor: "rgba(180, 83, 9, 0.2)",
      };
    }
    return {};
  };

  const avatarSrc = getAvatarSrc(user.avatarUrl, user.gender);

  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl border transition-all duration-300 gap-4"
      style={{
        backgroundColor: isCurrentUser ? "rgba(20, 184, 166, 0.05)" : "var(--bg-secondary)",
        borderColor: isCurrentUser ? "var(--accent-teal)" : "var(--border)",
        transform: isCurrentUser ? "scale(1.01)" : "none",
        boxShadow: isCurrentUser ? "0 4px 20px -2px rgba(20, 184, 166, 0.15)" : "none",
      }}
    >
      {/* Rank Indicator */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-tertiary)",
          ...getRankStyle(user.rank),
        }}
      >
        {getRankIcon(user.rank)}
      </div>

      {/* User Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-slate-950 overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <img
            src={avatarSrc}
            alt={user.displayName}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-extrabold text-white truncate flex items-center gap-1.5">
            {user.displayName}
            {isCurrentUser && (
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "rgba(20, 184, 166, 0.2)",
                  color: "#2dd4bf",
                }}
              >
                You
              </span>
            )}
          </h4>
          <p className="text-[11px] text-slate-500 font-medium">
            Accumulated {labels.xpLabel}: {user.xp}
          </p>
        </div>
      </div>

      {/* Level Badge */}
      <div
        className="shrink-0 rounded-lg px-3 py-1 border text-xs font-black"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        {labels.levelLabel === "Level" ? "LVL" : labels.levelLabel.toUpperCase()} {user.level}
      </div>
    </div>
  );
}
