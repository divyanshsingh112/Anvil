import { calculateCompletionRate } from "./completion-rate";

export interface MonthForecastResult {
  year: number;
  month: number;
  daysElapsed: number;
  daysRemaining: number;
  currentRatePercentage: number;
  projectedRatePercentage: number;
  confidenceBand: [number, number]; // [min, max]
  confidenceLevel: "high" | "medium" | "low";
  momentumSlope: number;
  completionsToDate: number;
  totalPossibleToDate: number;
  projectedTotalCompletions: number;
  projectedTotalSlots: number;
}

/**
 * Pure local computation (no AI) forecasting the user's month-end completion rate.
 * Combines current month completion rate with momentum slope (Phase 19).
 */
export async function calculateMonthForecast(
  userId: string,
  targetDateInput?: Date
): Promise<MonthForecastResult> {
  const { prisma } = await import("./prisma");

  const today = targetDateInput ? new Date(targetDateInput) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1; // 1-12

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = new Date(Date.UTC(year, month - 1, daysInMonth));

  const daysElapsed = today.getUTCDate();
  const daysRemaining = daysInMonth - daysElapsed;

  // 1. Current month completion rate up to today (using Phase 7/12 shared utility)
  const currentStats = await calculateCompletionRate(
    prisma,
    userId,
    startDate,
    today
  );

  const completionsToDate = currentStats.completions;
  const totalPossibleToDate = currentStats.totalPossible;
  const currentRateRatio =
    totalPossibleToDate > 0 ? completionsToDate / totalPossibleToDate : 0;

  // 2. Fetch momentum history for slope calculation
  const mlProfile = await prisma.mlUserProfile.findUnique({
    where: { userId },
    select: { momentumHistory: true },
  });

  let momentumSlope = 0;
  if (mlProfile?.momentumHistory) {
    try {
      const parsed =
        typeof mlProfile.momentumHistory === "string"
          ? JSON.parse(mlProfile.momentumHistory)
          : mlProfile.momentumHistory;

      if (Array.isArray(parsed) && parsed.length >= 2) {
        const recent = parsed.slice(-7);
        const n = recent.length;
        const xs = recent.map((_, i) => i);
        const ys = recent.map((e: any) => Number(e.score) || 0);
        const xMean = xs.reduce((a, b) => a + b, 0) / n;
        const yMean = ys.reduce((a, b) => a + b, 0) / n;

        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i++) {
          num += (xs[i] - xMean) * (ys[i] - yMean);
          den += (xs[i] - xMean) * (xs[i] - xMean);
        }
        momentumSlope = den > 0 ? num / den : 0;
      }
    } catch {
      momentumSlope = 0;
    }
  }

  // 3. Project daily completion rate for remaining days
  // Momentum slope nudges projected rate: +2 pts/day -> +1% per remaining day
  const momentumAdjustment = momentumSlope * 0.005 * daysRemaining;
  const projectedDailyRate = Math.min(
    1.0,
    Math.max(0.0, currentRateRatio + momentumAdjustment)
  );

  // 4. Calculate remaining scheduled slots for the rest of the month (with Phase 19 bug class guard)
  const habits = await prisma.habit.findMany({
    where: {
      userId,
      createdAt: { lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1) },
      OR: [
        { archivedAt: null },
        { archivedAt: { gte: today } },
      ],
    },
  });

  let remainingScheduledSlots = 0;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  for (let i = 1; i <= daysRemaining; i++) {
    const checkDay = new Date(today.getTime() + i * MS_PER_DAY);
    const dayOfWeek = checkDay.getUTCDay();

    for (const h of habits) {
      const created = new Date(h.createdAt);
      const archived = h.archivedAt ? new Date(h.archivedAt) : null;

      // PHASE 19 BUG CLASS GUARD
      if (created <= checkDay && (!archived || archived > checkDay)) {
        const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
        if (days.includes(dayOfWeek)) {
          remainingScheduledSlots++;
        }
      }
    }
  }

  // 5. Total month projection
  const projectedRemainingCompletions = projectedDailyRate * remainingScheduledSlots;
  const projectedTotalCompletions = completionsToDate + projectedRemainingCompletions;
  const projectedTotalSlots = totalPossibleToDate + remainingScheduledSlots;

  const projectedRateRatio =
    projectedTotalSlots > 0
      ? projectedTotalCompletions / projectedTotalSlots
      : currentRateRatio;

  const projectedRatePercentage = Math.round(projectedRateRatio * 100);

  // 6. Confidence Band & Level
  const margin = Math.round((12 * daysRemaining) / daysInMonth) + 3;
  const low = Math.max(0, projectedRatePercentage - margin);
  const high = Math.min(100, projectedRatePercentage + margin);

  const confidenceLevel: "high" | "medium" | "low" =
    daysRemaining <= 5 ? "high" : daysRemaining <= 15 ? "medium" : "low";

  return {
    year,
    month,
    daysElapsed,
    daysRemaining,
    currentRatePercentage: currentStats.percentage,
    projectedRatePercentage,
    confidenceBand: [low, high],
    confidenceLevel,
    momentumSlope: parseFloat(momentumSlope.toFixed(4)),
    completionsToDate,
    totalPossibleToDate,
    projectedTotalCompletions: Math.round(projectedTotalCompletions),
    projectedTotalSlots,
  };
}
