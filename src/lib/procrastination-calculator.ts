import { getISTDayOfWeek } from "@/lib/date-utils";

export interface AvoidancePattern {
  avoidedClass: string;
  substituteClass: string;
  rate: number;
}

export interface FingerprintResult {
  dangerZoneHours: number[] | "insufficient_data";
  lastMinuteRate: number | "insufficient_data";
  procrastinationScore: number | "insufficient_data";
  avoidancePattern: AvoidancePattern | null;
  confidence: {
    completionsCount: number;
    partialDaysCount: number;
  };
}

export const PROCRASTINATION_WEIGHTS = {
  LAST_MINUTE_RATE: 0.50,
  DANGER_ZONE: 0.30,
  AVOIDANCE_SUBSTITUTION: 0.20,
} as const;

/**
 * Calculates dangerZoneScore using Approach B (Mean Active Hour / Temporal Centroid).
 * 
 * Formula:
 * meanActiveHour = Σ(hour × count) / Σ(count)
 * dangerZoneScore = (clamp(meanActiveHour, 6, 23) - 6) / 17 × 100
 * 
 * - Early Bird (7 AM - 10 AM, mean = 8.0): (8 - 6)/17 * 100 = 11.76
 * - Late Finisher (9 PM - Midnight, mean = 22.0): (22 - 6)/17 * 100 = 94.12
 * - Midday (12 PM - 3 PM, mean = 13.0): (13 - 6)/17 * 100 = 41.18
 */
export function calculateDangerZoneScore(
  meanActiveHour: number | "insufficient_data"
): number | "insufficient_data" {
  if (
    meanActiveHour === "insufficient_data" ||
    typeof meanActiveHour !== "number" ||
    isNaN(meanActiveHour)
  ) {
    return "insufficient_data";
  }

  const clampedMean = Math.min(23, Math.max(6, meanActiveHour));
  const rawScore = ((clampedMean - 6) / 17) * 100;
  return parseFloat(Math.min(100, Math.max(0, rawScore)).toFixed(2));
}

/**
 * Calculates the multi-factor Composite Procrastination Score (0 - 100).
 * Formula: 0.50 * lastMinuteRate + 0.30 * dangerZoneScore + 0.20 * avoidanceScore
 * 
 * Sparse Data Protection:
 * - If lastMinuteRate is "insufficient_data" (completions < 10), returns "insufficient_data" to protect new users.
 * - If partialDaysCount < 5, avoidance is unmeasured and dynamically excluded from the denominator.
 */
export function calculateCompositeProcrastinationScore(
  lastMinuteRate: number | "insufficient_data",
  dangerZoneScore: number | "insufficient_data",
  avoidancePattern: AvoidancePattern | null,
  partialDaysCount: number = 0
): number | "insufficient_data" {
  if (lastMinuteRate === "insufficient_data") {
    return "insufficient_data";
  }

  // 1. Last-Minute Rate Signal (0 - 100 scale, 50% weight)
  const lastMinuteSignal = Number(lastMinuteRate) || 0;
  const lastMinuteWeight = PROCRASTINATION_WEIGHTS.LAST_MINUTE_RATE;

  // 2. Danger Zone Timing Signal (0 - 100 scale, 30% weight)
  const dangerZoneSignal =
    dangerZoneScore === "insufficient_data" ? 0 : Number(dangerZoneScore);
  const dangerZoneWeight =
    dangerZoneScore === "insufficient_data" ? 0 : PROCRASTINATION_WEIGHTS.DANGER_ZONE;

  // 3. Avoidance Substitution Signal (0 - 100 scale, 20% weight)
  // - Case C (Pattern detected): rate >= 70%, partialDays >= 5 -> rate * 100 (weight 0.20)
  // - Case B (Assessed, non-avoidance): partialDays >= 5, rate < 70% -> 0 (weight 0.20, rewards non-avoidance)
  // - Case A (Sparse partial days): partialDays < 5 -> unmeasured, exclude weight from denominator
  let avoidanceSignal = 0;
  let avoidanceWeight = 0;

  if (avoidancePattern !== null) {
    avoidanceSignal = Math.min(100, Math.max(0, avoidancePattern.rate * 100));
    avoidanceWeight = PROCRASTINATION_WEIGHTS.AVOIDANCE_SUBSTITUTION;
  } else if (partialDaysCount >= 5) {
    avoidanceSignal = 0;
    avoidanceWeight = PROCRASTINATION_WEIGHTS.AVOIDANCE_SUBSTITUTION;
  } else {
    avoidanceSignal = 0;
    avoidanceWeight = 0; // Excluded from denominator to prevent skewing new users
  }

  // 4. Weighted Sum & Effective Weight Normalization
  const weightedSum =
    lastMinuteSignal * lastMinuteWeight +
    dangerZoneSignal * dangerZoneWeight +
    avoidanceSignal * avoidanceWeight;

  const effectiveWeight = lastMinuteWeight + dangerZoneWeight + avoidanceWeight;

  if (effectiveWeight <= 0) return "insufficient_data";

  const score = Math.round(weightedSum / effectiveWeight);
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculates the user's Procrastination Fingerprint based on completions and active habits
 * over the last 30 days. Restricts calculations to non-skip completions.
 */
export async function calculateProcrastinationFingerprint(
  userId: string,
  targetDateInput?: Date,
  options?: {
    streakVolatility?: number;
    archetype?: string;
  }
): Promise<FingerprintResult> {
  const { prisma } = await import("./prisma");

  const today = targetDateInput ? new Date(targetDateInput) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  const start30DaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  start30DaysAgo.setUTCHours(0, 0, 0, 0);

  // 1. Query all completions for this user in the last 30 completed days
  const completions = await prisma.completion.findMany({
    where: {
      userId,
      date: {
        gte: start30DaysAgo,
        lte: today,
      },
    },
    include: {
      habit: true,
    },
  });

  // Filter out "skip" entries since completedAt = loggedAt is a weaker signal
  const nonSkipCompletions = completions.filter(
    (c: { timeAccuracy: string }) =>
      c.timeAccuracy === "confirmed" || c.timeAccuracy === "estimated"
  );

  // 2. Query habits active in this window
  const habits = await prisma.habit.findMany({
    where: {
      userId,
      OR: [
        { archivedAt: null },
        { archivedAt: { gte: start30DaysAgo } },
      ],
    },
  });

  // Calculate total scheduled habit slots in the last 30 completed days
  let totalScheduledSlots = 0;
  for (let i = 0; i < 30; i++) {
    const checkDay = new Date(start30DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = getISTDayOfWeek(checkDay);

    for (const h of habits) {
      const created = new Date(h.createdAt);
      const archived = h.archivedAt ? new Date(h.archivedAt) : null;

      // EXPLICIT CREATE DATE CHECK: Protect against Phase 19 new habit creation bug
      if (created <= checkDay && (!archived || archived > checkDay)) {
        const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
        if (days.includes(dayOfWeek)) {
          totalScheduledSlots++;
        }
      }
    }
  }

  const completionsCount = nonSkipCompletions.length;

  // --- DANGER ZONE & LAST MINUTE THRESHOLD ---
  const MIN_COMPLETIONS_THRESHOLD = 10;
  let dangerZoneHours: number[] | "insufficient_data" = "insufficient_data";
  let lastMinuteRate: number | "insufficient_data" = "insufficient_data";
  let meanActiveHour: number | "insufficient_data" = "insufficient_data";

  if (completionsCount >= MIN_COMPLETIONS_THRESHOLD) {
    // A. Mean Active Hour / Temporal Centroid Calculation (Approach B)
    let totalHourWeight = 0;
    for (const c of nonSkipCompletions) {
      const rawHour = new Date(c.completedAt).getHours();
      // Map late-night hours (0-4 AM) as end-of-day continuation (24-28)
      const logicalHour = rawHour < 6 ? rawHour + 24 : rawHour;
      totalHourWeight += logicalHour;
    }
    meanActiveHour = totalHourWeight / completionsCount;
    const clampedMean = Math.min(23, Math.max(6, meanActiveHour));

    // Primary execution window representing the 3-hour centroid span
    const centerHour = Math.floor(clampedMean);
    dangerZoneHours = [centerHour, (centerHour + 1) % 24, (centerHour + 2) % 24];

    // B. Last-Minute Rate (completions at or after 10PM, or before 5AM)
    let lateCount = 0;
    for (const c of nonSkipCompletions) {
      const hour = new Date(c.completedAt).getHours();
      if (hour >= 22 || hour < 5) {
        lateCount++;
      }
    }
    lastMinuteRate = parseFloat(((lateCount / completionsCount) * 100).toFixed(2));
  }

  // --- AVOIDANCE SUBSTITUTION PATTERN ---
  // Group scheduled slots and completions by date to detect partial completion days
  const dailyScheduled: Record<string, string[]> = {};
  const dailyCompleted: Record<string, string[]> = {};

  for (let i = 0; i < 30; i++) {
    const checkDay = new Date(start30DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = getISTDayOfWeek(checkDay);
    const dateStr = `${checkDay.getUTCFullYear()}-${String(checkDay.getUTCMonth() + 1).padStart(2, "0")}-${String(checkDay.getUTCDate()).padStart(2, "0")}`;

    dailyScheduled[dateStr] = [];
    dailyCompleted[dateStr] = [];

    for (const h of habits) {
      const created = new Date(h.createdAt);
      const archived = h.archivedAt ? new Date(h.archivedAt) : null;
      if (created <= checkDay && (!archived || archived > checkDay)) {
        const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
        if (days.includes(dayOfWeek)) {
          dailyScheduled[dateStr].push(h.id);
        }
      }
    }
  }

  // Group completions by date (using completion date field)
  for (const c of completions) {
    const cDate = new Date(c.date);
    const dateStr = `${cDate.getUTCFullYear()}-${String(cDate.getUTCMonth() + 1).padStart(2, "0")}-${String(cDate.getUTCDate()).padStart(2, "0")}`;
    if (dateStr in dailyCompleted) {
      dailyCompleted[dateStr].push(c.habitId);
    }
  }

  let partialDaysCount = 0;
  const pairCounts: Record<string, number> = {}; // "skipped_class->completed_class": count

  for (const dateStr in dailyScheduled) {
    const schedIds = dailyScheduled[dateStr];
    const compIds = dailyCompleted[dateStr];

    if (schedIds.length === 0) continue;

    // Find skipped habit IDs
    const skippedIds = schedIds.filter((id) => !compIds.includes(id));

    if (compIds.length > 0 && skippedIds.length > 0) {
      partialDaysCount++;

      // Map unique classes completed and skipped
      const completedClasses = new Set<string>();
      for (const id of compIds) {
        const h = habits.find((x: { id: string; class: string }) => x.id === id);
        if (h) completedClasses.add(h.class);
      }

      const skippedClasses = new Set<string>();
      for (const id of skippedIds) {
        const h = habits.find((x: { id: string; class: string }) => x.id === id);
        if (h) skippedClasses.add(h.class);
      }

      // Find substitution patterns
      for (const skipped of Array.from(skippedClasses)) {
        for (const completed of Array.from(completedClasses)) {
          if (skipped !== completed) {
            const key = `${skipped}->${completed}`;
            pairCounts[key] = (pairCounts[key] || 0) + 1;
          }
        }
      }
    }
  }

  // Enforce thresholds: at least 5 partial completion days and 70% rate
  let avoidancePattern: AvoidancePattern | null = null;
  const MIN_PARTIAL_DAYS_THRESHOLD = 5;
  const MIN_PATTERN_CONFIDENCE = 0.70;

  if (partialDaysCount >= MIN_PARTIAL_DAYS_THRESHOLD) {
    let strongestKey = "";
    let maxCount = 0;

    for (const key in pairCounts) {
      if (pairCounts[key] > maxCount) {
        maxCount = pairCounts[key];
        strongestKey = key;
      }
    }

    if (strongestKey) {
      const rate = maxCount / partialDaysCount;
      if (rate >= MIN_PATTERN_CONFIDENCE) {
        const [avoidedClass, substituteClass] = strongestKey.split("->");
        avoidancePattern = {
          avoidedClass,
          substituteClass,
          rate: parseFloat(rate.toFixed(2)),
        };
      }
    }
  }

  const dangerZoneScore = calculateDangerZoneScore(meanActiveHour);
  const procrastinationScore = calculateCompositeProcrastinationScore(
    lastMinuteRate,
    dangerZoneScore,
    avoidancePattern,
    partialDaysCount
  );

  return {
    dangerZoneHours,
    lastMinuteRate,
    procrastinationScore,
    avoidancePattern,
    confidence: {
      completionsCount,
      partialDaysCount,
    },
  };
}
