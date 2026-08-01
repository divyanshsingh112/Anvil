import { Prisma } from "@prisma/client";

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
  LAST_MINUTE_RATE: 0.40,
  AVOIDANCE_PATTERN: 0.35,
  STREAK_VOLATILITY: 0.25,
  NIGHT_OWL_DAMPENING: 0.50,
} as const;

/**
 * Calculates the multi-factor Composite Procrastination Score (0 - 100).
 * Combines lastMinuteRate, avoidancePattern strength, streakVolatility, and Night Owl archetype dampening.
 */
export function calculateCompositeProcrastinationScore(
  lastMinuteRate: number | "insufficient_data",
  avoidancePattern: AvoidancePattern | null,
  streakVolatility: number,
  archetype: string,
  partialDaysCount: number = 0
): number | "insufficient_data" {
  if (lastMinuteRate === "insufficient_data") {
    return "insufficient_data";
  }

  // 1. Raw Signals (0 - 100 scale)
  const lastMinuteSignal = Number(lastMinuteRate) || 0;
  const volatilitySignal = Math.min(100, Math.max(0, streakVolatility * 100));

  // 2. Split Avoidance Pattern Null-Handling Logic:
  // - Case C (Pattern detected): rate >= 70%, partialDays >= 5. Signal = rate * 100, include 0.35 in denominator.
  // - Case B (Assessed, low-avoidance): partialDays >= 5, rate < 70%. Signal = 0, include 0.35 in denominator (rewards proven non-avoidance).
  // - Case A (Insufficient partial days): partialDays < 5. Avoidance is unmeasured -> Exclude 0.35 weight from denominator.
  let avoidanceSignal = 0;
  let includeAvoidanceWeight = false;

  if (avoidancePattern !== null) {
    avoidanceSignal = Math.min(100, Math.max(0, avoidancePattern.rate * 100));
    includeAvoidanceWeight = true;
  } else if (partialDaysCount >= 5) {
    avoidanceSignal = 0;
    includeAvoidanceWeight = true;
  } else {
    avoidanceSignal = 0;
    includeAvoidanceWeight = false;
  }

  // 3. Archetype Adjustment (Dampen last-minute contribution for Night Owls)
  const isNightOwl = (archetype || "").toLowerCase() === "night_owl";
  const adjustedLastMinuteSignal = isNightOwl
    ? lastMinuteSignal * PROCRASTINATION_WEIGHTS.NIGHT_OWL_DAMPENING
    : lastMinuteSignal;

  const lastMinuteWeight = isNightOwl
    ? PROCRASTINATION_WEIGHTS.LAST_MINUTE_RATE * PROCRASTINATION_WEIGHTS.NIGHT_OWL_DAMPENING
    : PROCRASTINATION_WEIGHTS.LAST_MINUTE_RATE;

  const avoidanceWeight = includeAvoidanceWeight ? PROCRASTINATION_WEIGHTS.AVOIDANCE_PATTERN : 0;
  const volatilityWeight = PROCRASTINATION_WEIGHTS.STREAK_VOLATILITY;

  // 4. Weighted Sum & Effective Weight Normalization
  const weightedSum =
    adjustedLastMinuteSignal * PROCRASTINATION_WEIGHTS.LAST_MINUTE_RATE +
    avoidanceSignal * PROCRASTINATION_WEIGHTS.AVOIDANCE_PATTERN +
    volatilitySignal * PROCRASTINATION_WEIGHTS.STREAK_VOLATILITY;

  const effectiveWeight = lastMinuteWeight + avoidanceWeight + volatilityWeight;

  if (effectiveWeight <= 0) return 0;

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
    (c) => c.timeAccuracy === "confirmed" || c.timeAccuracy === "estimated"
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
    const dayOfWeek = checkDay.getDay();

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

  if (completionsCount >= MIN_COMPLETIONS_THRESHOLD) {
    // A. Danger Zone Hours (Rolling 3-hour window between 6 AM and 11 PM with lowest completions count)
    const hourCounts = new Array(24).fill(0);
    for (const c of nonSkipCompletions) {
      const hour = new Date(c.completedAt).getHours();
      hourCounts[hour]++;
    }

    let lowestCount = Infinity;
    let bestStartHour = 6;

    // Slide 3-hour window from 6 AM to 9 PM (so window fits inside 6 AM - 11 PM waking hours)
    for (let h = 6; h <= 21; h++) {
      const count = hourCounts[h] + hourCounts[h + 1] + hourCounts[h + 2];
      if (count < lowestCount) {
        lowestCount = count;
        bestStartHour = h;
      }
    }
    dangerZoneHours = [bestStartHour, bestStartHour + 1, bestStartHour + 2];

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
    const dayOfWeek = checkDay.getDay();
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
        const h = habits.find((x) => x.id === id);
        if (h) completedClasses.add(h.class);
      }

      const skippedClasses = new Set<string>();
      for (const id of skippedIds) {
        const h = habits.find((x) => x.id === id);
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

  const streakVolatility = options?.streakVolatility ?? 0;
  const archetype = options?.archetype ?? "steady_strategist";
  const procrastinationScore = calculateCompositeProcrastinationScore(
    lastMinuteRate,
    avoidancePattern,
    streakVolatility,
    archetype,
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
