import { prisma } from "@/lib/prisma";
import { toZonedTime } from "date-fns-tz";

const IST = "Asia/Kolkata";

export interface ConsistencyTrendPoint {
  month: number;
  year: number;
  label: string;
  percentage: number;
  /** Distinguishes "0% no habits" from "0% had habits but none completed" */
  hadHabits: boolean;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Computes the completion rate for each of the last 6 calendar months
 * (current month + previous 5) in a single consolidated database query
 * and in-memory aggregation.
 *
 * Returns an array of 6 data points, ordered oldest → newest.
 */
export async function calculateConsistencyTrend(
  userId: string
): Promise<ConsistencyTrendPoint[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const todayMidnight = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );

  // Compute month boundaries for the 6-month window (offset 5 down to 0)
  const monthConfigs = [];
  for (let offset = 5; offset >= 0; offset--) {
    let targetMonth = currentMonth - offset;
    let targetYear = currentYear;

    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear--;
    }

    const startDate = new Date(Date.UTC(targetYear, targetMonth, 1));
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const endDate = new Date(Date.UTC(targetYear, targetMonth, daysInMonth));
    const effectiveEnd = endDate.getTime() > todayMidnight.getTime()
      ? todayMidnight
      : endDate;

    monthConfigs.push({
      month: targetMonth + 1,
      year: targetYear,
      label: MONTH_LABELS[targetMonth],
      startDate,
      endDate,
      effectiveEnd,
    });
  }

  // Earliest start date across the 6-month window (5 months ago)
  const earliestStartDate = monthConfigs[0].startDate;
  // Latest effective end date across the 6-month window (current month capped to today)
  const latestEffectiveEnd = monthConfigs[monthConfigs.length - 1].effectiveEnd;

  // Single roundtrip: fetch all habits and all completions across the entire 6-month window
  const [habits, rawCompletions] = await Promise.all([
    prisma.habit.findMany({
      where: {
        userId,
        createdAt: { lte: new Date(latestEffectiveEnd.getTime() + 24 * 60 * 60 * 1000 - 1) },
        OR: [
          { archivedAt: null },
          { archivedAt: { gte: earliestStartDate } },
        ],
      },
      select: {
        id: true,
        scheduledDays: true,
        createdAt: true,
        archivedAt: true,
      },
    }),
    prisma.completion.findMany({
      where: {
        userId,
        date: {
          gte: earliestStartDate,
          lte: latestEffectiveEnd,
        },
      },
      select: {
        habitId: true,
        date: true,
      },
    }),
  ]);

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // Pre-process completions with timestamp and IST day of week for fast lookup
  const processedCompletions = rawCompletions.map((c) => {
    const compDate = new Date(c.date);
    return {
      habitId: c.habitId,
      dateMs: compDate.getTime(),
      dayOfWeek: toZonedTime(compDate, IST).getDay(),
    };
  });

  // Pre-process habits with UTC midnight timestamps for fast date-range filtering
  const processedHabits = habits.map((h) => {
    const createdDate = new Date(h.createdAt);
    const habitCreatedMidnight = Date.UTC(
      createdDate.getFullYear(),
      createdDate.getMonth(),
      createdDate.getDate()
    );

    let habitArchivedMidnight: number | null = null;
    if (h.archivedAt) {
      const archivedDate = new Date(h.archivedAt);
      habitArchivedMidnight = Date.UTC(
        archivedDate.getFullYear(),
        archivedDate.getMonth(),
        archivedDate.getDate()
      );
    }

    const scheduledList =
      h.scheduledDays && h.scheduledDays.length > 0
        ? h.scheduledDays
        : [0, 1, 2, 3, 4, 5, 6];

    return {
      id: h.id,
      createdAtMs: new Date(h.createdAt).getTime(),
      habitCreatedMidnight,
      archivedAt: h.archivedAt,
      archivedAtMs: h.archivedAt ? new Date(h.archivedAt).getTime() : null,
      habitArchivedMidnight,
      scheduledList,
    };
  });

  const habitMap = new Map(processedHabits.map((h) => [h.id, h]));

  return monthConfigs.map(({ month, year, label, startDate, effectiveEnd }) => {
    // If startDate is after effectiveEnd, empty (future month)
    if (startDate.getTime() > effectiveEnd.getTime()) {
      return {
        month,
        year,
        label,
        percentage: 0,
        hadHabits: false,
      };
    }

    const startMs = startDate.getTime();
    const endMs = effectiveEnd.getTime();
    const endPlusDayMs = endMs + 24 * 60 * 60 * 1000 - 1;

    // Filter habits active during this specific month
    const monthHabits = processedHabits.filter((h) => {
      const createdMatch = h.createdAtMs <= endPlusDayMs;
      const archivedMatch =
        !h.archivedAt || (h.archivedAtMs !== null && h.archivedAtMs >= startMs);
      return createdMatch && archivedMatch;
    });

    // Filter and count valid completions in this specific month
    let validCompletionsCount = 0;
    for (const comp of processedCompletions) {
      if (comp.dateMs < startMs || comp.dateMs > endMs) continue;
      const habit = habitMap.get(comp.habitId);
      if (!habit) continue;

      if (habit.habitCreatedMidnight > comp.dateMs) continue;
      if (
        habit.habitArchivedMidnight !== null &&
        habit.habitArchivedMidnight < comp.dateMs
      )
        continue;

      if (habit.scheduledList.includes(comp.dayOfWeek)) {
        validCompletionsCount++;
      }
    }

    // Calculate total possible completions (denominator)
    let totalPossible = 0;
    const dayCount = Math.floor((endMs - startMs) / MS_PER_DAY) + 1;

    for (const habit of monthHabits) {
      for (let i = 0; i < dayCount; i++) {
        const currentDayMs = startMs + i * MS_PER_DAY;

        if (habit.habitCreatedMidnight > currentDayMs) continue;
        if (
          habit.habitArchivedMidnight !== null &&
          habit.habitArchivedMidnight < currentDayMs
        )
          continue;

        const currentDay = new Date(currentDayMs);
        const currentIST = toZonedTime(currentDay, IST);
        const dayOfWeek = currentIST.getDay();

        if (habit.scheduledList.includes(dayOfWeek)) {
          totalPossible++;
        }
      }
    }

    const rawPercentage =
      totalPossible > 0
        ? Math.round((validCompletionsCount / totalPossible) * 100)
        : 0;

    const percentage = Math.min(rawPercentage, 100);

    return {
      month,
      year,
      label,
      percentage,
      hadHabits: monthHabits.length > 0,
    };
  });
}

