/**
 * Phase 22: Adaptive Difficulty Evaluator Engine
 *
 * Scoped to a single habit. Evaluates rolling 30-day performance to recommend
 * difficulty tier changes (suggest_harder / suggest_easier / none) while
 * respecting a 14-day cooldown and minimum data threshold (≥14 days age, ≥10 scheduled slots).
 */

export type RecommendationType = "suggest_harder" | "suggest_easier" | "none";
export type EvaluatorStatus = "eligible" | "insufficient_data" | "cooldown";

export interface HabitScopedMetrics {
  completionRate: number;      // 0-1 (completions / scheduled slots)
  streakVolatility: number;    // 0-1 (breakDays / scheduled slots for this habit)
  lastMinuteRate: number;      // 0-100 (% of non-skip completions between 22:00 and 04:59)
  scheduledSlots: number;      // total active scheduled days in window
  completionsCount: number;    // total completions in window
  habitAgeDays: number;        // days since habit.createdAt
}

export interface DifficultyEvaluationResult {
  habitId: string;
  habitName: string;
  currentDifficulty: string;   // novice | adept | master
  targetDifficulty: string | null; // suggested tier or null
  recommendation: RecommendationType;
  status: EvaluatorStatus;
  metrics: HabitScopedMetrics | null;
  cooldownRemainingDays?: number;
  reason: string;
  energyNudgeApplied?: boolean;
  energyReason?: string;
}

const MIN_HABIT_AGE_DAYS = 14;
const MIN_SCHEDULED_SLOTS = 10;
const COOLDOWN_DAYS = 14;

/**
 * Evaluates a single habit for adaptive difficulty tier changes.
 */
export async function evaluateHabitDifficulty(
  habitId: string,
  targetDateInput?: Date,
  options?: { energyLevel?: "low" | "medium" | "high" | null }
): Promise<DifficultyEvaluationResult> {
  const { prisma } = await import("./prisma");
  const { FEATURE_ENERGY_CHECKIN } = await import("../config/features");

  const today = targetDateInput ? new Date(targetDateInput) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  // 1. Fetch Habit
  const habit = await prisma.habit.findUnique({
    where: { id: habitId },
  });

  if (!habit || habit.archivedAt) {
    return {
      habitId,
      habitName: habit?.name || "Unknown",
      currentDifficulty: habit?.difficulty || "novice",
      targetDifficulty: null,
      recommendation: "none",
      status: "insufficient_data",
      metrics: null,
      reason: "Habit not found or archived",
    };
  }

  // 2. Check Cooldown (14 days)
  if (habit.lastDifficultySuggestionAt) {
    const lastSuggestionDate = new Date(habit.lastDifficultySuggestionAt);
    const diffMs = today.getTime() - lastSuggestionDate.getTime();
    const cooldownDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (cooldownDays < COOLDOWN_DAYS) {
      const cooldownRemainingDays = COOLDOWN_DAYS - cooldownDays;
      return {
        habitId: habit.id,
        habitName: habit.name,
        currentDifficulty: habit.difficulty,
        targetDifficulty: null,
        recommendation: "none",
        status: "cooldown",
        metrics: null,
        cooldownRemainingDays,
        reason: `Difficulty evaluation in 14-day cooldown period (${cooldownRemainingDays} days remaining)`,
      };
    }
  }

  // 3. Compute 30-day completed historical window bounds (days -30 to -1, excluding unfinished today)
  const start30DaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  start30DaysAgo.setUTCHours(0, 0, 0, 0);

  const habitAgeDays = Math.floor(
    (today.getTime() - new Date(habit.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // 4. Calculate scheduled slots in last 30 completed days
  let scheduledSlots = 0;
  const scheduledDateStrs: string[] = [];

  for (let i = 0; i < 30; i++) {
    const checkDay = new Date(start30DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = checkDay.getUTCDay();

    const created = new Date(habit.createdAt);
    const archived = habit.archivedAt ? new Date(habit.archivedAt) : null;

    if (created <= checkDay && (!archived || archived > checkDay)) {
      const days = (habit.scheduledDays && habit.scheduledDays.length > 0) ? habit.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
      if (days.includes(dayOfWeek)) {
        scheduledSlots++;
        const dateStr = `${checkDay.getUTCFullYear()}-${String(checkDay.getUTCMonth() + 1).padStart(2, "0")}-${String(checkDay.getUTCDate()).padStart(2, "0")}`;
        scheduledDateStrs.push(dateStr);
      }
    }
  }

  // 5. Insufficient Data Gate
  if (habitAgeDays < MIN_HABIT_AGE_DAYS || scheduledSlots < MIN_SCHEDULED_SLOTS) {
    return {
      habitId: habit.id,
      habitName: habit.name,
      currentDifficulty: habit.difficulty,
      targetDifficulty: null,
      recommendation: "none",
      status: "insufficient_data",
      metrics: null,
      reason: `Insufficient habit history (requires ≥14 days age and ≥10 scheduled slots; currently ${habitAgeDays}d age, ${scheduledSlots} slots)`,
    };
  }

  // 6. Query completions for this habit in the last 30 completed days
  const completions = await prisma.completion.findMany({
    where: {
      userId: habit.userId,
      habitId: habit.id,
      date: {
        gte: start30DaysAgo,
        lte: today,
      },
    },
  });

  const completionsCount = completions.length;
  const completionRate = scheduledSlots > 0 ? completionsCount / scheduledSlots : 0;

  // Calculate habit-scoped streak volatility (breakDays / scheduledSlots)
  let breakDays = 0;
  for (const dateStr of scheduledDateStrs) {
    const hasCompletion = completions.some((c: { date: Date }) => {
      const cd = new Date(c.date);
      const cStr = `${cd.getUTCFullYear()}-${String(cd.getUTCMonth() + 1).padStart(2, "0")}-${String(cd.getUTCDate()).padStart(2, "0")}`;
      return cStr === dateStr;
    });
    if (!hasCompletion) {
      breakDays++;
    }
  }
  const streakVolatility = scheduledSlots > 0 ? breakDays / scheduledSlots : 0;

  // Calculate habit-scoped last-minute rate
  const nonSkipCompletions = completions.filter(
    (c: { timeAccuracy: string }) => c.timeAccuracy !== "skipped"
  );

  let lateCount = 0;
  for (const c of nonSkipCompletions) {
    const hour = new Date(c.completedAt).getUTCHours();
    if (hour >= 22 || hour < 5) {
      lateCount++;
    }
  }
  const lastMinuteRate =
    nonSkipCompletions.length > 0
      ? (lateCount / nonSkipCompletions.length) * 100
      : 0;

  const metrics: HabitScopedMetrics = {
    completionRate: parseFloat(completionRate.toFixed(4)),
    streakVolatility: parseFloat(streakVolatility.toFixed(4)),
    lastMinuteRate: parseFloat(lastMinuteRate.toFixed(2)),
    scheduledSlots,
    completionsCount,
    habitAgeDays,
  };

  // 7. Evaluate recommendation rules
  let recommendation: RecommendationType = "none";
  let targetDifficulty: string | null = null;
  let reason = "Habit performance is balanced within current difficulty tier";
  let energyNudgeApplied = false;
  let energyReason: string | undefined = undefined;

  const curr = habit.difficulty.toLowerCase();

  // Suggest Harder: high completion rate (>=85%), low volatility (<=20%), low late night (<30%)
  if (completionRate >= 0.85 && streakVolatility <= 0.20 && lastMinuteRate < 30.0) {
    if (curr === "novice") {
      recommendation = "suggest_harder";
      targetDifficulty = "adept";
      reason = "Consistently high completion rate with low friction. Ready to step up to Adept!";
    } else if (curr === "adept") {
      recommendation = "suggest_harder";
      targetDifficulty = "master";
      reason = "Master-level performance demonstrated. Ready to challenge Master tier!";
    }
  }
  // Suggest Easier: low completion rate (<=40%) AND (high volatility >=50% OR high late night >=50%)
  else if (completionRate <= 0.40 && (streakVolatility >= 0.50 || lastMinuteRate >= 50.0)) {
    if (curr === "master") {
      recommendation = "suggest_easier";
      targetDifficulty = "adept";
      reason = "High friction observed on Master tier. Easing to Adept will help rebuild momentum.";
    } else if (curr === "adept") {
      recommendation = "suggest_easier";
      targetDifficulty = "novice";
      reason = "Consistent missed days observed. Easing to Novice will reduce cognitive load.";
    }
  }

  // Energy Check-in Nudge Rule
  if (
    FEATURE_ENERGY_CHECKIN &&
    options?.energyLevel === "low" &&
    recommendation === "none" &&
    curr !== "novice" &&
    completionRate <= 0.60
  ) {
    recommendation = "suggest_easier";
    targetDifficulty = curr === "master" ? "adept" : "novice";
    energyNudgeApplied = true;
    energyReason = "Because you're low on energy today, we suggested an easier version";
    reason = "Because you're low on energy today, we suggested an easier version";
  }

  return {
    habitId: habit.id,
    habitName: habit.name,
    currentDifficulty: habit.difficulty,
    targetDifficulty,
    recommendation,
    status: "eligible",
    metrics,
    reason,
    energyNudgeApplied,
    energyReason,
  };
}
