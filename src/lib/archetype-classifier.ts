/**
 * Phase 21: Behavioral Archetype Classifier
 *
 * Deterministic rule-based classification (v1) that assigns each user
 * to one of four archetypes based on a 6-dimension feature vector derived
 * from their last 30 days of habit completion data.
 *
 * Classifier version is stored alongside the result so future algorithm
 * swaps (e.g., K-Means when there's enough data) don't overwrite labels
 * ambiguously.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface ArchetypeFeatures {
  weekdayRate: number;     // completion rate Mon-Fri (0-1)
  weekendRate: number;     // completion rate Sat-Sun (0-1)
  eveningNightRatio: number; // % of non-skip completions after 8PM or before 5AM (0-1)
  streakVolatility: number;  // streak-break days / total active days (0-1)
  lastMinuteRate: number;    // reused from Phase 20 MlUserProfile (0-100)
  momentumTrend: number;     // slope of momentum history (positive = improving)
}

export type ArchetypeLabel =
  | "steady_strategist"
  | "weekend_warrior"
  | "night_owl"
  | "momentum_builder";

export interface ClassificationResult {
  archetype: ArchetypeLabel | "insufficient_data";
  features: ArchetypeFeatures | null;
  classifierVersion: number;
  confidence: {
    completionsCount: number;
    accountAgeDays: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────────

const CLASSIFIER_VERSION = 1;
const MIN_COMPLETIONS_THRESHOLD = 15;
const MIN_ACCOUNT_AGE_DAYS = 14;

// ─── Main ───────────────────────────────────────────────────────────

/**
 * Classifies a user into a behavioral archetype.
 * Returns "insufficient_data" if the user doesn't meet minimum thresholds.
 */
import { PrismaClient } from "@prisma/client";
import { getISTDayOfWeek, getISTDateParts } from "@/lib/date-utils";

export async function classifyArchetype(
  userId: string,
  targetDateInput?: Date
): Promise<ClassificationResult> {
  const { prisma } = await import("./prisma");

  const targetDate = targetDateInput ? new Date(targetDateInput) : new Date();
  const todayParts = getISTDateParts(targetDate);
  const todayMidnight = Date.UTC(todayParts.year, todayParts.month, todayParts.day);

  const start30DaysAgo = new Date(todayMidnight - 30 * 24 * 60 * 60 * 1000);

  // ── 1. Check account age threshold ────────────────────────────────

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    return {
      archetype: "insufficient_data",
      features: null,
      classifierVersion: CLASSIFIER_VERSION,
      confidence: { completionsCount: 0, accountAgeDays: 0 },
    };
  }

  const createdParts = getISTDateParts(new Date(user.createdAt));
  const createdMidnight = Date.UTC(createdParts.year, createdParts.month, createdParts.day);

  const accountAgeDays = Math.floor(
    (todayMidnight - createdMidnight) / (24 * 60 * 60 * 1000)
  );

  // ── 2. Fetch completions in the last 30 days ─────────────────────

  const completions = await prisma.completion.findMany({
    where: {
      userId,
      date: { gte: start30DaysAgo, lte: new Date(todayMidnight) },
    },
    include: { habit: true },
  });

  // Filter out "skip" entries for time-based metrics
  const nonSkipCompletions = completions.filter(
    (c: { timeAccuracy: string }) => c.timeAccuracy === "confirmed" || c.timeAccuracy === "estimated"
  );

  const completionsCount = nonSkipCompletions.length;

  // ── 3. Insufficient data gate ─────────────────────────────────────

  if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS || completionsCount < MIN_COMPLETIONS_THRESHOLD) {
    return {
      archetype: "insufficient_data",
      features: null,
      classifierVersion: CLASSIFIER_VERSION,
      confidence: { completionsCount, accountAgeDays },
    };
  }

  // ── 4. Fetch habits active in window ──────────────────────────────

  const habits = await prisma.habit.findMany({
    where: {
      userId,
      OR: [
        { archivedAt: null },
        { archivedAt: { gte: start30DaysAgo } },
      ],
    },
  });

  // ── 5. Compute weekday/weekend rates ──────────────────────────────

  let weekdayScheduled = 0;
  let weekendScheduled = 0;
  let weekdayCompleted = 0;
  let weekendCompleted = 0;

  // Build scheduled slots with createdAt guard (Phase 19 bug class prevention)
  for (let i = 0; i < 30; i++) {
    const checkDay = new Date(start30DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = getISTDayOfWeek(checkDay); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const h of habits) {
      const created = new Date(h.createdAt);
      const archived = h.archivedAt ? new Date(h.archivedAt) : null;

      // PHASE 19 BUG CLASS GUARD: only count days after habit creation
      if (created <= checkDay && (!archived || archived > checkDay)) {
        const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
        if (days.includes(dayOfWeek)) {
          if (isWeekend) weekendScheduled++;
          else weekdayScheduled++;
        }
      }
    }
  }

  // Count completions by weekday/weekend (using all completions including skip
  // since we're measuring engagement, not timing)
  for (const c of completions) {
    const cDay = getISTDayOfWeek(c.date);
    const isWeekend = cDay === 0 || cDay === 6;
    if (isWeekend) weekendCompleted++;
    else weekdayCompleted++;
  }

  const weekdayRate = weekdayScheduled > 0 ? weekdayCompleted / weekdayScheduled : 0;
  const weekendRate = weekendScheduled > 0 ? weekendCompleted / weekendScheduled : 0;

  // ── 6. Compute evening/night ratio ────────────────────────────────

  let eveningNightCount = 0;
  for (const c of nonSkipCompletions) {
    const hour = new Date(c.completedAt).getHours();
    if (hour >= 20 || hour < 5) {
      eveningNightCount++;
    }
  }
  const eveningNightRatio = completionsCount > 0 ? eveningNightCount / completionsCount : 0;

  // ── 7. Compute streak volatility ──────────────────────────────────
  // Count days where the user had at least one scheduled habit but zero completions
  // ("streak break" days) vs total days with any scheduled habits

  let activeDaysCount = 0;
  let breakDaysCount = 0;

  for (let i = 0; i < 30; i++) {
    const checkDay = new Date(start30DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = getISTDayOfWeek(checkDay);
    const dateStr = `${checkDay.getUTCFullYear()}-${String(checkDay.getUTCMonth() + 1).padStart(2, "0")}-${String(checkDay.getUTCDate()).padStart(2, "0")}`;

    // Count scheduled habits for this day (with createdAt guard)
    let scheduledForDay = 0;
    for (const h of habits) {
      const created = new Date(h.createdAt);
      const archived = h.archivedAt ? new Date(h.archivedAt) : null;
      if (created <= checkDay && (!archived || archived > checkDay)) {
        const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
        if (days.includes(dayOfWeek)) {
          scheduledForDay++;
        }
      }
    }

    if (scheduledForDay > 0) {
      activeDaysCount++;

      // Check if ANY completion exists for this day
      const hasCompletion = completions.some((c: { date: Date }) => {
        const cDate = new Date(c.date);
        const cStr = `${cDate.getUTCFullYear()}-${String(cDate.getUTCMonth() + 1).padStart(2, "0")}-${String(cDate.getUTCDate()).padStart(2, "0")}`;
        return cStr === dateStr;
      });

      if (!hasCompletion) {
        breakDaysCount++;
      }
    }
  }

  const streakVolatility = activeDaysCount > 0 ? breakDaysCount / activeDaysCount : 0;

  // ── 8. Get last-minute rate from Phase 20 ─────────────────────────

  const mlProfile = await prisma.mlUserProfile.findUnique({
    where: { userId },
    select: { lastMinuteRate: true, momentumHistory: true },
  });

  const lastMinuteRate = mlProfile?.lastMinuteRate
    ? Number(mlProfile.lastMinuteRate)
    : 0;

  // ── 9. Compute momentum trend ─────────────────────────────────────
  // Linear slope of the last 7 momentum history entries

  let momentumTrend = 0;
  if (mlProfile?.momentumHistory) {
    try {
      const parsed =
        typeof mlProfile.momentumHistory === "string"
          ? JSON.parse(mlProfile.momentumHistory)
          : mlProfile.momentumHistory;

      if (Array.isArray(parsed) && parsed.length >= 2) {
        const recent = parsed.slice(-7);
        // Simple least-squares slope: Σ(xi - x̄)(yi - ȳ) / Σ(xi - x̄)²
        const n = recent.length;
        const xs = recent.map((_: any, i: number) => i);
        const ys = recent.map((entry: any) => Number(entry.score) || 0);
        const xMean = xs.reduce((a: number, b: number) => a + b, 0) / n;
        const yMean = ys.reduce((a: number, b: number) => a + b, 0) / n;

        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i++) {
          num += (xs[i] - xMean) * (ys[i] - yMean);
          den += (xs[i] - xMean) * (xs[i] - xMean);
        }
        momentumTrend = den > 0 ? num / den : 0;
      }
    } catch {
      // Malformed JSON — treat as no trend data
      momentumTrend = 0;
    }
  }

  // ── 10. Build feature vector ──────────────────────────────────────

  const features: ArchetypeFeatures = {
    weekdayRate: parseFloat(weekdayRate.toFixed(4)),
    weekendRate: parseFloat(weekendRate.toFixed(4)),
    eveningNightRatio: parseFloat(eveningNightRatio.toFixed(4)),
    streakVolatility: parseFloat(streakVolatility.toFixed(4)),
    lastMinuteRate: parseFloat(lastMinuteRate.toFixed(2)),
    momentumTrend: parseFloat(momentumTrend.toFixed(4)),
  };

  // ── 11. Classify ──────────────────────────────────────────────────
  // Priority order: Weekend Warrior → Night Owl → Momentum Builder → Steady Strategist

  let archetype: ArchetypeLabel;

  if (weekendRate > weekdayRate * 1.5 && weekendRate >= 0.5) {
    // Clear weekend-dominant pattern
    archetype = "weekend_warrior";
  } else if (eveningNightRatio >= 0.40 || lastMinuteRate >= 40) {
    // Late-night completion tendency
    archetype = "night_owl";
  } else if (momentumTrend > 0 && streakVolatility > 0.3) {
    // Improving trajectory but inconsistent day-to-day
    archetype = "momentum_builder";
  } else {
    // Reliable, consistent — default supportive archetype
    archetype = "steady_strategist";
  }

  return {
    archetype,
    features,
    classifierVersion: CLASSIFIER_VERSION,
    confidence: { completionsCount, accountAgeDays },
  };
}
