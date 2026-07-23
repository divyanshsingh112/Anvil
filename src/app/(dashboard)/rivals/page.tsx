"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLabels } from "@/hooks/useLabels";
import { Swords, Plus, Loader2, Trophy, Frown, Users, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import RivalCard from "@/components/gamification/RivalCard";

interface ActiveDuel {
  id: string;
  habitName: string;
  startDate: string;
  endDate: string;
  challengerId: string;
  challengerName: string;
  challengerCount: number;
  rivalId: string;
  rivalName: string;
  rivalCount: number;
  daysRemaining: number;
}

interface PendingChallenge {
  id: string;
  habitName: string;
  challengerId?: string;
  challengerName?: string;
  rivalId?: string;
  rivalName?: string;
  createdAt: string;
}

interface HistoryDuel {
  id: string;
  habitName: string;
  startDate: string;
  endDate: string;
  challengerId: string;
  challengerName: string;
  challengerCount: number;
  rivalId: string;
  rivalName: string;
  rivalCount: number;
  status: string;
  winnerId: string | null;
  defeatMessage: string | null;
  createdAt: string;
}

interface HabitItem {
  id: string;
  name: string;
}

export default function RivalsPage() {
  const labels = useLabels();
  const { data: session } = useSession();
  const userId = session?.user?.id || "";

  // Data states
  const [activeDuels, setActiveDuels] = useState<ActiveDuel[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<PendingChallenge[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingChallenge[]>([]);
  const [historyDuels, setHistoryDuels] = useState<HistoryDuel[]>([]);
  const [userHabits, setUserHabits] = useState<HabitItem[]>([]);
  const [stats, setStats] = useState({ wins: 0, losses: 0, ties: 0 });

  // Loading and pagination states
  const [isLoading, setIsLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasNextHistoryPage, setHasNextHistoryPage] = useState(false);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);

  // Form states
  const [searchRival, setSearchRival] = useState("");
  const [selectedHabitId, setSelectedHabitId] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fetchActiveAndStats = async () => {
    try {
      const res = await fetch("/api/rivals/active");
      if (!res.ok) throw new Error("Failed to fetch active duels");
      const data = await res.json();
      setActiveDuels(data.active || []);
      setPendingIncoming(data.pendingIncoming || []);
      setPendingOutgoing(data.pendingOutgoing || []);
      setStats(data.stats || { wins: 0, losses: 0, ties: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async (page: number) => {
    try {
      const res = await fetch(`/api/rivals/history?page=${page}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistoryDuels(data.data || []);
      setHasNextHistoryPage(data.pagination?.hasNextPage || false);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHabits = async () => {
    try {
      const now = new Date();
      const res = await fetch(`/api/habits?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      if (res.ok) {
        const data = await res.json();
        setUserHabits(data.map((h: any) => ({ id: h.id, name: h.name })) || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllData = async () => {
    if (!userId) return;
    setIsLoading(true);
    await Promise.all([
      fetchActiveAndStats(),
      fetchHistory(historyPage),
      fetchHabits(),
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (userId) {
      loadAllData();
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchHistory(historyPage);
    }
  }, [historyPage]);

  // Form submission
  const handleChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!searchRival.trim()) {
      setFormError("Please enter a username or email");
      return;
    }
    if (!selectedHabitId) {
      setFormError(`Please select one of your ${labels.habitPlural.toLowerCase()}`);
      return;
    }

    const selectedHabit = userHabits.find((h) => h.id === selectedHabitId);
    if (!selectedHabit) return;

    setIsSubmittingChallenge(true);
    try {
      const res = await fetch("/api/rivals/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rivalUsername: searchRival.trim(),
          habitId: selectedHabitId,
          habitName: selectedHabit.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send challenge");
      }

      setSearchRival("");
      setSelectedHabitId("");
      setFormSuccess("Challenge sent successfully!");
      fetchActiveAndStats();
    } catch (err: any) {
      setFormError(err.message || "Failed to challenge user");
    } finally {
      setIsSubmittingChallenge(false);
    }
  };

  const totalDuels = stats.wins + stats.losses + stats.ties;
  const winRate = totalDuels > 0 ? Math.round((stats.wins / totalDuels) * 100) : 0;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <span className="text-sm text-slate-400 font-medium">Loading {labels.rivalPlural.toLowerCase()}...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Header and Stats */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Swords className="h-8 w-8 text-purple-500" />
            {labels.rivalPlural}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Challenge friends to a 7-day habit duel. Track separately, compete together.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 shadow-lg backdrop-blur-sm">
          <div className="text-center px-2">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Duels</p>
            <p className="text-lg font-black text-white mt-0.5">{totalDuels}</p>
          </div>
          <div className="text-center px-2 border-l border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Wins</p>
            <p className="text-lg font-black text-emerald-400 mt-0.5">{stats.wins}</p>
          </div>
          <div className="text-center px-2 border-l border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Losses</p>
            <p className="text-lg font-black text-rose-400 mt-0.5">{stats.losses}</p>
          </div>
          <div className="text-center px-2 border-l border-slate-800">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Win rate</p>
            <p className="text-lg font-black text-purple-400 mt-0.5">{winRate}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main section: active duels and history */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          {/* Active Duels Section */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" /> Active Duels
            </h2>

            {activeDuels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-950/20">
                <Swords className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-400 mt-2">No active duels at the moment</p>
                <p className="text-xs text-slate-500 mt-1">Send a challenge to a friend to start a duel!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeDuels.map((duel) => (
                  <RivalCard
                    key={duel.id}
                    duel={duel}
                    userId={userId}
                    type="active"
                    onActionSuccess={fetchActiveAndStats}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Pending Challenges Incoming */}
          {pendingIncoming.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-yellow-500" /> Pending Challenges
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingIncoming.map((duel) => (
                  <RivalCard
                    key={duel.id}
                    duel={duel}
                    userId={userId}
                    userHabits={userHabits}
                    type="pending-incoming"
                    onActionSuccess={fetchActiveAndStats}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed History Section */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-500" /> Duel History
            </h2>

            {historyDuels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center bg-slate-950/20">
                <Frown className="h-6 w-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">No completed duels yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {historyDuels.map((duel) => (
                    <RivalCard
                      key={duel.id}
                      duel={duel}
                      userId={userId}
                      type="history"
                      onActionSuccess={fetchActiveAndStats}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-2 p-3 bg-slate-900/40 border border-slate-800 rounded-xl">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-slate-400 font-bold">Page {historyPage}</span>
                  <button
                    onClick={() => setHistoryPage((p) => p + 1)}
                    disabled={!hasNextHistoryPage}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>

        </div>

        {/* Sidebar: Send Challenge Form & Outgoing pending */}
        <div className="flex flex-col gap-8">
          {/* Send Challenge Form */}
          <section className="bg-slate-900/40 p-5 rounded-xl border border-slate-800 flex flex-col gap-4">
            <h3 className="text-md font-extrabold text-white tracking-tight flex items-center gap-1.5">
              <Plus className="h-5 w-5 text-purple-400" /> Challenge a {labels.rivalLabel}
            </h3>

            <form onSubmit={handleChallengeSubmit} className="flex flex-col gap-3">
              {formError && <p className="text-xs text-red-500 bg-red-500/10 p-2 rounded">{formError}</p>}
              {formSuccess && <p className="text-xs text-emerald-500 bg-emerald-500/10 p-2 rounded">{formSuccess}</p>}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">Friend's Username or Email:</label>
                <input
                  type="text"
                  value={searchRival}
                  onChange={(e) => setSearchRival(e.target.value)}
                  placeholder="e.g. friend@example.com"
                  className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-300">Choose your Habit to duel on:</label>
                <select
                  value={selectedHabitId}
                  onChange={(e) => setSelectedHabitId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition"
                  required
                >
                  <option value="">-- Select a Habit --</option>
                  {userHabits.map((habit) => (
                    <option key={habit.id} value={habit.id}>{habit.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingChallenge}
                className="w-full mt-2 py-2 rounded bg-purple-600 hover:bg-purple-700 font-extrabold text-white text-xs tracking-wide shadow-md transition flex items-center justify-center gap-1"
              >
                {isSubmittingChallenge ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Swords className="h-3.5 w-3.5" />} Challenge!
              </button>
            </form>
          </section>

          {/* Outgoing Challenges */}
          {pendingOutgoing.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                Sent Challenges
              </h3>
              <div className="flex flex-col gap-3">
                {pendingOutgoing.map((duel) => (
                  <RivalCard
                    key={duel.id}
                    duel={duel}
                    userId={userId}
                    type="pending-outgoing"
                    onActionSuccess={fetchActiveAndStats}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
