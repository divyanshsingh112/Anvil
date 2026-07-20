import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Shared utility for calculating completion rate over a date range.
 *
 * Consolidates the activeDays / createdAt / archivedAt -aware success-rate
 * logic that was previously duplicated across:
 *   - /api/completions/month-stats  (Phase 7)
 *   - lib/report-card-calculator.ts (Phase 12)
 *   - lib/consistency-trend-calculator.ts (Phase 13)
 *
 * All three call sites now share this single implementation.
 */

export interface CompletionRateResult {
  completions: number;
  totalPossible: number;
  percentage: number;
  /** True if at least one habit existed during any part of the date range */
  hadHabits: boolean;
}

/**
 * Calculates the completion rate for a user over a given date range.
 *
 * @param db        Prisma client or transaction client
 * @param userId    The user's ID
 * @param startDate Start of range (inclusive), midnight UTC
 * @param endDate   End of range (inclusive), midnight UTC
 *
 * Respects:
 *   - activeDays: habit only counted on its scheduled weekdays
 *   - createdAt:  habit only counted from the day it was created
 *   - archivedAt: habit only counted up to the day it was archived
 *   - Future dates are capped to today
 */
export async function calculateCompletionRate(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<CompletionRateResult> {
  const now = new Date();
  const todayMidnight = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );

  // Cap end date to today so we don't count future days as "missed"
  const effectiveEnd = endDate.getTime() > todayMidnight.getTime()
    ? todayMidnight
    : endDate;

  // If startDate is after effectiveEnd, the range is empty (future month)
  if (startDate.getTime() > effectiveEnd.getTime()) {
    return { completions: 0, totalPossible: 0, percentage: 0, hadHabits: false };
  }

  // Fetch habits that existed during any part of the date range:
  //   - Created on or before the end of the range
  //   - Not archived before the start of the range (or not archived at all)
  const habits = await db.habit.findMany({
    where: {
      userId,
      createdAt: { lte: new Date(effectiveEnd.getTime() + 24 * 60 * 60 * 1000 - 1) },
      OR: [
        { archivedAt: null },
        { archivedAt: { gte: startDate } },
      ],
    },
    select: {
      id: true,
      activeDays: true,
      createdAt: true,
      archivedAt: true,
    },
  });

  // Count completions within the date range
  const completions: number = await db.completion.count({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: effectiveEnd,
      },
    },
  });

  // Calculate total possible completions (the denominator)
  let totalPossible = 0;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const dayCount = Math.floor(
    (effectiveEnd.getTime() - startDate.getTime()) / MS_PER_DAY
  ) + 1;

  for (const habit of habits) {
    const createdDate = new Date(habit.createdAt);
    const habitCreatedMidnight = Date.UTC(
      createdDate.getFullYear(),
      createdDate.getMonth(),
      createdDate.getDate()
    );

    let habitArchivedMidnight: number | null = null;
    if (habit.archivedAt) {
      const archivedDate = new Date(habit.archivedAt);
      habitArchivedMidnight = Date.UTC(
        archivedDate.getFullYear(),
        archivedDate.getMonth(),
        archivedDate.getDate()
      );
    }

    for (let i = 0; i < dayCount; i++) {
      const currentDay = new Date(startDate.getTime() + i * MS_PER_DAY);
      const currentDayMs = currentDay.getTime();

      // Skip if habit didn't exist yet
      if (habitCreatedMidnight > currentDayMs) continue;

      // Skip if habit was archived before this day
      if (habitArchivedMidnight !== null && habitArchivedMidnight < currentDayMs) continue;

      // Check activeDays schedule
      const dayOfWeek = currentDay.getUTCDay();
      if (
        habit.activeDays &&
        habit.activeDays.length > 0 &&
        !habit.activeDays.includes(dayOfWeek)
      ) {
        continue;
      }

      totalPossible++;
    }
  }

  const percentage = totalPossible > 0
    ? Math.round((completions / totalPossible) * 100)
    : 0;

  return {
    completions,
    totalPossible,
    percentage,
    hadHabits: habits.length > 0,
  };
}
