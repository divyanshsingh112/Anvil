"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useHabitStore } from "@/store/useHabitStore";
import { useUserStore } from "@/store/useUserStore";
import { useLabels } from "@/hooks/useLabels";
import HabitList from "@/components/habits/HabitList";
import HabitForm from "@/components/habits/HabitForm";
import SessionTimePrompt from "@/components/habits/SessionTimePrompt";
import Breadcrumb from "@/components/shared/Breadcrumb";
import Heatmap from "@/components/dashboard/Heatmap";
import MonthStats from "@/components/dashboard/MonthStats";
import StreakBadge from "@/components/gamification/StreakBadge";
import AchievementToast from "@/components/gamification/AchievementToast";
import { Habit, ResolvedChain } from "@/types";
import { Plus, Coins, Trophy, Flame, Loader2 } from "lucide-react";
import ChainCard from "@/components/habits/ChainCard";
import ChainForm from "@/components/habits/ChainForm";

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

export default function MonthTrackerPage() {
  const params = useParams();
  const labels = useLabels();
  
  const year = parseInt(params.year as string, 10);
  const month = parseInt(params.month as string, 10);

  const {
    habits,
    isLoading,
    error,
    sessionTimeBucket,
    fetchHabits,
    archiveHabit,
    setCurrentPeriod,
    toggleCompletion,
  } = useHabitStore();

  const {
    xp,
    level,
    coins,
    longestStreak,
    fetchUserStats,
  } = useUserStore();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedHabit, setSelectedHabit] = useState<Habit | undefined>(
    undefined
  );

  // States to handle today's briefing intercept
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    habitId: string;
    completed: boolean;
  } | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<{
    key: string;
    name: string;
    xpReward: number;
    icon: string;
  }[]>([]);

  // Custom toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quest Chains state
  const [chains, setChains] = useState<ResolvedChain[]>([]);
  const [chainFormOpen, setChainFormOpen] = useState(false);
  const [isChainsLoading, setIsChainsLoading] = useState(true);

  const fetchChains = useCallback(async () => {
    setIsChainsLoading(true);
    try {
      const res = await fetch("/api/chains");
      if (res.ok) {
        const json = await res.json();
        setChains(json);
      }
    } catch (err) {
      console.error("Failed to fetch chains:", err);
    } finally {
      setIsChainsLoading(false);
    }
  }, []);

  // Check if viewing current real-world period
  const now = new Date();
  const isTodayPeriod =
    year === now.getFullYear() && month === now.getMonth() + 1;

  // Sync the store's current period with URL params and fetch data in parallel
  useEffect(() => {
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      setCurrentPeriod(year, month);
      Promise.all([
        fetchHabits(year, month),
        fetchUserStats(),
        fetchChains(),
      ]);
    }
  }, [year, month, fetchHabits, fetchUserStats, fetchChains, setCurrentPeriod]);

  const handleCreateClick = useCallback(() => {
    setFormMode("create");
    setSelectedHabit(undefined);
    setFormOpen(true);
  }, []);

  const handleEditClick = useCallback((habit: Habit) => {
    setFormMode("edit");
    setSelectedHabit(habit);
    setFormOpen(true);
  }, []);

  const handleArchiveClick = useCallback(async (id: string) => {
    if (
      confirm(
        `Are you sure you want to archive this ${labels.habitSingular.toLowerCase()}? it will no longer show in active lists.`
      )
    ) {
      try {
        await archiveHabit(id);
      } catch (err) {
        const errorObj = err as Error;
        alert(errorObj.message || `Failed to archive ${labels.habitSingular.toLowerCase()}`);
      }
    }
  }, [archiveHabit, labels.habitSingular]);

  const handleToggleHabit = useCallback(async (
    habitId: string,
    completed: boolean,
    options?: {
      timeBucket?: "morning" | "afternoon" | "evening" | "night" | null;
      timeAccuracy?: "confirmed" | "estimated" | "skip";
      customCompletedAt?: string;
    }
  ) => {
    // Intercept if completing today and no session bucket selected yet
    const resolved =
      sessionStorage.getItem("anvil_session_time_bucket_prompt_resolved") ===
      "true";
    if (completed && !sessionTimeBucket && !resolved && !options) {
      setPendingToggle({ habitId, completed });
      setPromptOpen(true);
      return;
    }

    try {
      const response = await toggleCompletion(habitId, completed, options);
      if (response) {
        // Sync chains state on toggle
        fetchChains();

        if (response.newAchievements && response.newAchievements.length > 0) {
          setUnlockedAchievements(response.newAchievements);
        }
        
        if (response.chainCompleted) {
          setToastMessage(
            `🔗 CHAIN COMPLETED! "${response.chainCompleted.chainName}" (+${response.chainCompleted.bonusXp} ${labels.xpLabel}) 🔗`
          );
          setTimeout(() => setToastMessage(null), 6000);
        } else if (response.leveledUp) {
          setToastMessage(
            `✨ LEVEL UP! You reached Level ${response.user.level}! ✨`
          );
          setTimeout(() => setToastMessage(null), 5000);
        } else if (response.perfectDay) {
          setToastMessage(
            `🏆 ${labels.perfectDayLabel.toUpperCase()}! All ${labels.habitPlural.toLowerCase()} completed (+5 ${labels.coinsLabel.toLowerCase()}) 🏆`
          );
          setTimeout(() => setToastMessage(null), 5500);
        }
      }
      return response;
    } catch (err) {
      const errorObj = err as Error;
      alert(errorObj.message || "Failed to toggle completion");
    }
  }, [fetchChains, labels.coinsLabel, labels.habitPlural, labels.perfectDayLabel, labels.xpLabel, sessionTimeBucket, toggleCompletion]);

  const handlePromptResolve = useCallback(async () => {
    setPromptOpen(false);
    if (pendingToggle) {
      try {
        const response = await toggleCompletion(
          pendingToggle.habitId,
          pendingToggle.completed
        );
        if (response) {
          // Sync chains state on toggle
          fetchChains();

          if (response.chainCompleted) {
            setToastMessage(
              `🔗 CHAIN COMPLETED! "${response.chainCompleted.chainName}" (+${response.chainCompleted.bonusXp} ${labels.xpLabel}) 🔗`
            );
            setTimeout(() => setToastMessage(null), 6000);
          } else if (response.leveledUp) {
            setToastMessage(
              `✨ LEVEL UP! You reached Level ${response.user.level}! ✨`
            );
            setTimeout(() => setToastMessage(null), 5000);
          } else if (response.perfectDay) {
            setToastMessage(
              `🏆 ${labels.perfectDayLabel.toUpperCase()}! All ${labels.habitPlural.toLowerCase()} completed (+5 ${labels.coinsLabel.toLowerCase()}) 🏆`
            );
            setTimeout(() => setToastMessage(null), 5500);
          }
        }
      } catch (err) {
        const errorObj = err as Error;
        alert(errorObj.message || `Failed to complete ${labels.habitSingular.toLowerCase()} after briefing`);
      } finally {
        setPendingToggle(null);
      }
    }
  }, [fetchChains, labels.coinsLabel, labels.habitPlural, labels.habitSingular, labels.perfectDayLabel, labels.xpLabel, pendingToggle, toggleCompletion]);

  // Validation
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--text-secondary)" }}>
          Invalid year or month
        </p>
      </main>
    );
  }

  const monthName = MONTH_NAMES[month - 1];

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <Breadcrumb
        segments={[
          { label: String(year), href: `/year/${year}` },
          {
            label: monthName,
            href: `/year/${year}/month/${month}`,
          },
        ]}
      />

      {/* Gamification Stats Banner */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl border shadow-sm"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-950/40 border border-indigo-800">
            <Trophy className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {labels.levelLabel}
            </div>
            <div className="text-xl font-black text-white">{level}</div>
            <div className="text-[10px] text-indigo-300 font-semibold">
              {xp} Total {labels.xpLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-yellow-950/40 border border-yellow-800">
            <Coins className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {labels.coinsLabel}
            </div>
            <div className="text-xl font-black text-white">{coins}</div>
            <div className="text-[10px] text-yellow-300 font-semibold">
              {labels.coinsLabel === "Gold" ? "Gold Reserves" : labels.coinsLabel === "Fuel" ? "Fuel Reserves" : "MVP Reserves"}
            </div>
          </div>
        </div>

        <StreakBadge />

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 border border-slate-700">
            <Flame className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Best {labels.streakLabel}
            </div>
            <div className="text-xl font-black text-white">
              {longestStreak} days
            </div>
            <div className="text-[10px] text-slate-400 font-semibold">
              All-time record
            </div>
          </div>
        </div>
      </div>

      {/* Custom Toast Message Banner */}
      {toastMessage && (
        <div
          className="rounded-lg px-4 py-3 text-center text-sm font-bold border animate-pulse shadow-md transition-all"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--accent-purple)",
            color: "var(--text-primary)",
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Month Stats Widgets */}
      <MonthStats year={year} month={month} />

      {/* Heatmap */}
      <Heatmap year={year} month={month} />

      {/* Quest Chains Section */}
      {isTodayPeriod && (
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              {labels.chainPlural}
            </h2>
            <button
              onClick={() => setChainFormOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--accent-teal)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              New {labels.chainLabel}
            </button>
          </div>

          {isChainsLoading && chains.length === 0 ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Loading {labels.chainPlural.toLowerCase()}...</span>
            </div>
          ) : chains.length === 0 ? (
            <p className="text-xs italic py-2 animate-pulse" style={{ color: "var(--text-muted)" }}>
              No {labels.chainPlural.toLowerCase()} forged yet. Link active {labels.habitPlural.toLowerCase()} together for double {labels.xpLabel}!
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {chains.map((chain) => (
                <ChainCard
                  key={chain.id}
                  chain={chain}
                  onDeleteSuccess={fetchChains}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Header and New Quest Button */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {monthName} {year}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {isTodayPeriod
              ? `Your active ${labels.habitSingular.toLowerCase()} journal — complete today's ${labels.habitPlural.toLowerCase()}!`
              : `Viewing ${monthName} ${year} (read-only)`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isTodayPeriod && (
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--accent-purple)" }}
            >
              <Plus className="h-4 w-4" />
              {labels.createActionLabel}
            </button>
          )}
        </div>
      </div>

      {/* Main List / Content */}
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

      {isLoading && habits.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : (
        <HabitList
          habits={habits}
          onEditHabit={handleEditClick}
          onArchiveHabit={handleArchiveClick}
          onCreateQuestClick={handleCreateClick}
          onToggleHabit={handleToggleHabit}
          isTodayPeriod={isTodayPeriod}
        />
      )}

      {/* Form Dialog/Overlay */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-xl rounded-xl border p-6 shadow-xl"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
          >
            <HabitForm
              mode={formMode}
              initialHabit={selectedHabit}
              year={year}
              month={month}
              onSuccess={() => {
                setFormOpen(false);
              }}
              onCancel={() => setFormOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Session Time Briefing Prompt Dialog/Overlay */}
      {promptOpen && <SessionTimePrompt onResolve={handlePromptResolve} />}

      {/* Achievement Unlocked Toast Overlay */}
      {unlockedAchievements.length > 0 && (
        <AchievementToast
          achievements={unlockedAchievements}
          onClose={() => setUnlockedAchievements([])}
        />
      )}

      {/* Chain Form Dialog/Overlay */}
      {chainFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-xl rounded-xl border p-6 shadow-xl"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
          >
            <ChainForm
              activeHabits={habits.filter((h) => h.archivedAt === null)}
              onSuccess={() => {
                setChainFormOpen(false);
                fetchChains();
              }}
              onCancel={() => setChainFormOpen(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
}
