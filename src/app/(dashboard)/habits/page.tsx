"use client";

import { useEffect, useState } from "react";
import { useHabitStore } from "@/store/useHabitStore";
import HabitList from "@/components/habits/HabitList";
import HabitForm from "@/components/habits/HabitForm";
import { Habit } from "@/types";
import { Plus } from "lucide-react";

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
    fetchHabits,
    archiveHabit,
    setCurrentPeriod,
  } = useHabitStore();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedHabit, setSelectedHabit] = useState<Habit | undefined>(undefined);

  // Fetch on mount and period change
  useEffect(() => {
    fetchHabits(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchHabits]);

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

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto space-y-8">
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
    </main>
  );
}
