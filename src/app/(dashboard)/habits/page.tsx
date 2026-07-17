"use client";

import { useEffect, useState } from "react";
import { useHabitStore } from "@/store/useHabitStore";
import { useUserStore } from "@/store/useUserStore";
import HabitList from "@/components/habits/HabitList";
import HabitForm from "@/components/habits/HabitForm";
import SessionTimePrompt from "@/components/habits/SessionTimePrompt";
import { Habit } from "@/types";
import { Plus, Coins, Trophy, Flame } from "lucide-react";
import confetti from "canvas-confetti";

const YEARS = [2024, 2025, 2026, 2027, 2028];
const MONTHS = [
  { name: "January", value: 1 },
  { name: "February", value: 2 },
  { name: "March", value: 3 },
  { name: "April", value: 4 },
  { name: "May", value: 5 },
  { name: "June", value: 6 },
  { name: "July", value: 7 },
  { name: "August", value: 8 },
  { name: "September", value: 9 },
  { name: "October", value: 10 },
  { name: "November", value: 11 },
  { name: "December", value: 12 },
];

export default function HabitsPage() {
  const {
    habits,
    currentYear,
    currentMonth,
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
    streak,
    longestStreak,
    fetchUserStats,
  } = useUserStore();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedHabit, setSelectedHabit] = useState<Habit | undefined>(undefined);

  // States to handle today's briefing intercept
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ habitId: string; completed: boolean } | null>(null);
  
  // Custom toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Check if viewing current real-world period
  const now = new Date();
  const isTodayPeriod = currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1);

  // Fetch habits and user stats on mount and period change
  useEffect(() => {
    fetchHabits(currentYear, currentMonth);
    fetchUserStats();
  }, [currentYear, currentMonth, fetchHabits, fetchUserStats]);

  const handlePeriodChange = (year: number, month: number) => {
    setCurrentPeriod(year, month);
  };

  const handleCreateClick = () => {
    setFormMode("create");
    setSelectedHabit(undefined);
    setFormOpen(true);
  };

  const handleEditClick = (habit: Habit) => {
    setFormMode("edit");
    setSelectedHabit(habit);
    setFormOpen(true);
  };

  const handleArchiveClick = async (id: string) => {
    if (confirm("Are you sure you want to archive this quest? it will no longer show in active lists.")) {
      try {
        await archiveHabit(id);
      } catch (err) {
        const errorObj = err as Error;
        alert(errorObj.message || "Failed to archive quest");
      }
    }
  };

  const handleToggleHabit = async (
    habitId: string,
    completed: boolean,
    options?: {
      timeBucket?: "morning" | "afternoon" | "evening" | "night" | null;
      timeAccuracy?: "confirmed" | "estimated" | "skip";
      customCompletedAt?: string;
    }
  ) => {
    // Intercept if completing today and no session bucket selected yet
    const resolved = sessionStorage.getItem("anvil_session_time_bucket_prompt_resolved") === "true";
    if (completed && !sessionTimeBucket && !resolved && !options) {
      setPendingToggle({ habitId, completed });
      setPromptOpen(true);
      return;
    }

    try {
      const response = await toggleCompletion(habitId, completed, options);
      if (response) {
        if (response.leveledUp) {
          // Trigger confetti burst!
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
          });
          setToastMessage(`✨ LEVEL UP! You reached Level ${response.user.level}! ✨`);
          setTimeout(() => setToastMessage(null), 5000);
        } else if (response.perfectDay) {
          setToastMessage(`🏆 PERFECT DAY! All quests completed (+5 coins) 🏆`);
          setTimeout(() => setToastMessage(null), 5500);
        }
      }
    } catch (err) {
      const errorObj = err as Error;
      alert(errorObj.message || "Failed to toggle completion");
    }
  };

  const handlePromptResolve = async () => {
    setPromptOpen(false);
    if (pendingToggle) {
      try {
        const response = await toggleCompletion(pendingToggle.habitId, pendingToggle.completed);
        if (response) {
          if (response.leveledUp) {
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 },
            });
            setToastMessage(`✨ LEVEL UP! You reached Level ${response.user.level}! ✨`);
            setTimeout(() => setToastMessage(null), 5000);
          } else if (response.perfectDay) {
            setToastMessage(`🏆 PERFECT DAY! All quests completed (+5 coins) 🏆`);
            setTimeout(() => setToastMessage(null), 5500);
          }
        }
      } catch (err) {
        const errorObj = err as Error;
        alert(errorObj.message || "Failed to complete quest after briefing");
      } finally {
        setPendingToggle(null);
      }
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto space-y-8">
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Level</div>
            <div className="text-xl font-black text-white">{level}</div>
            <div className="text-[10px] text-indigo-300 font-semibold">{xp} Total XP</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-yellow-950/40 border border-yellow-800">
            <Coins className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coins</div>
            <div className="text-xl font-black text-white">{coins}</div>
            <div className="text-[10px] text-yellow-300 font-semibold">Gold Reserves</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-950/40 border border-orange-800">
            <Flame className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Streak</div>
            <div className="text-xl font-black text-white">{streak} days</div>
            <div className="text-[10px] text-orange-300 font-semibold">Active Run</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 border border-slate-700">
            <Flame className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Best Streak</div>
            <div className="text-xl font-black text-white">{longestStreak} days</div>
            <div className="text-[10px] text-slate-400 font-semibold">All-time record</div>
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

      {/* Header and Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Quest Journal
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Forge and manage your daily habits and custom trials
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={currentMonth}
            onChange={(e) => handlePeriodChange(currentYear, parseInt(e.target.value, 10))}
            className="rounded-lg border px-3 py-2 text-sm font-semibold outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={currentYear}
            onChange={(e) => handlePeriodChange(parseInt(e.target.value, 10), currentMonth)}
            className="rounded-lg border px-3 py-2 text-sm font-semibold outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent-purple)" }}
          >
            <Plus className="h-4 w-4" />
            New Quest
          </button>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
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
              year={currentYear}
              month={currentMonth}
              onSuccess={() => {
                setFormOpen(false);
              }}
              onCancel={() => setFormOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Session Time Briefing Prompt Dialog/Overlay */}
      {promptOpen && (
        <SessionTimePrompt onResolve={handlePromptResolve} />
      )}
    </main>
  );
}
