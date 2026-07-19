"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import LeaderboardRow from "@/components/gamification/LeaderboardRow";
import { Trophy, Loader2 } from "lucide-react";

interface LeaderboardUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  rank: number;
}

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [currentUser, setCurrentUser] = useState<LeaderboardUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) {
        throw new Error("Failed to fetch leaderboard data");
      }
      const data = await res.json();
      setLeaderboard(data.leaderboard);
      setCurrentUser(data.currentUser);
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to load leaderboard");
    } finally {
      setIsLoading(false);
    }
  };

  const isCurrentUserInTop50 = leaderboard.some((u) => u.id === session?.user?.id);

  return (
    <main
      className="min-h-screen py-10 px-4 max-w-4xl mx-auto flex flex-col gap-8 pb-32"
      style={{ color: "var(--text-primary)" }}
    >
      {/* Title Header */}
      <div className="border-b pb-6" style={{ borderColor: "var(--border)" }}>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2.5 text-white">
          <Trophy className="h-8 w-8 text-yellow-400 animate-pulse shrink-0" />
          Hall of Heroes
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Compete globally, complete quests, and claim your place on the leaderboard
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 border text-sm text-center"
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
            Fetching hero rankings...
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {leaderboard.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              No heroes found on the board.
            </div>
          ) : (
            leaderboard.map((user) => (
              <LeaderboardRow
                key={user.id}
                user={user}
                isCurrentUser={user.id === session?.user?.id}
              />
            ))
          )}
        </div>
      )}

      {/* Pinned Current User Rank (if outside top 50) */}
      {!isLoading && currentUser && !isCurrentUserInTop50 && (
        <div
          className="fixed bottom-0 left-0 right-0 p-4 border-t backdrop-blur-md z-30"
          style={{
            backgroundColor: "rgba(10, 10, 12, 0.9)",
            borderColor: "var(--border)",
          }}
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Your Current Standing
            </span>
            <LeaderboardRow user={currentUser} isCurrentUser={true} />
          </div>
        </div>
      )}
    </main>
  );
}
