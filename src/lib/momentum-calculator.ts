import { Prisma } from "@prisma/client";

/**
 * Computes the Momentum Score (0-100) for a user based on 5 weighted factors.
 * Allows passing an optional targetDate (defaults to now) to support synthetic test runs.
 */
export async function calculateMomentumScore(userId: string, targetDateInput?: Date): Promise<{
  score: number;
  scoreTrend: number;
  scoreStreak: number;
  scoreLogin: number;
  scoreConsistency: number;
  scoreBest7: number;
}> {
  const { prisma } = await import("./prisma");

  const today = targetDateInput ? new Date(targetDateInput) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  // 1. Fetch User data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      streak: true,
      longestStreak: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found for momentum calculation");
  }

  // 2. Fetch completions in the last 60 days
  const start60DaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
  const completions = await prisma.completion.findMany({
    where: {
      userId,
      date: {
        gte: start60DaysAgo,
        lte: today,
      },
    },
    select: {
      date: true,
      timeBucket: true,
      habitId: true,
      habit: {
        select: {
          class: true,
          difficulty: true,
        },
      },
    },
  });

  // Fetch active habits (archivedAt is null or archivedAt >= start60DaysAgo)
  const habits = await prisma.habit.findMany({
    where: {
      userId,
      OR: [
        { archivedAt: null },
        { archivedAt: { gte: start60DaysAgo } },
      ],
    },
  });

  // --- FACTOR 1: Completion Rate Trend (30%) ---
  // R1: Last 14 days (days 0-13 ago)
  // R2: Previous 14 days (days 14-27 ago)
  const start14DaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const start28DaysAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);

  const completionsLast14 = completions.filter(c => new Date(c.date) >= start14DaysAgo);
  const completionsPrev14 = completions.filter(c => new Date(c.date) >= start28DaysAgo && new Date(c.date) < start14DaysAgo);

  let scheduledLast14 = 0;
  let scheduledPrev14 = 0;

  for (let i = 0; i < 14; i++) {
    const checkDayR1 = new Date(start14DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeekR1 = checkDayR1.getDay();
    
    const checkDayR2 = new Date(start28DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeekR2 = checkDayR2.getDay();

    for (const h of habits) {
      // Check if habit was created before/during this day and not archived yet
      const created = new Date(h.createdAt);
      const archived = h.archivedAt ? new Date(h.archivedAt) : null;

      const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];

      if (created <= checkDayR1 && (!archived || archived > checkDayR1)) {
        if (days.includes(dayOfWeekR1)) scheduledLast14++;
      }

      if (created <= checkDayR2 && (!archived || archived > checkDayR2)) {
        if (days.includes(dayOfWeekR2)) scheduledPrev14++;
      }
    }
  }

  const R1 = scheduledLast14 > 0 ? completionsLast14.length / scheduledLast14 : 0;
  const R2 = scheduledPrev14 > 0 ? completionsPrev14.length / scheduledPrev14 : 0;
  const scoreTrend = Math.min(100, Math.max(0, R1 * 100 + (R1 - R2) * 30));

  // --- FACTOR 2: Streak vs Personal Best (25%) ---
  const scoreStreak = user.longestStreak > 0
    ? Math.min(100, Math.max(0, (user.streak / user.longestStreak) * 100))
    : 0;

  // --- FACTOR 3: Days Since Last Login (20%) ---
  let daysSinceLastLogin = 0;
  if (user.lastLoginAt) {
    const diffTime = today.getTime() - new Date(user.lastLoginAt).getTime();
    daysSinceLastLogin = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }
  const scoreLogin = Math.max(0, 100 - daysSinceLastLogin * 15);

  // --- FACTOR 4: Day-of-Week Consistency (15%) ---
  // Completion rates per weekday (0-6) over the last 28 days
  const ratesPerWeekday = [];
  for (let d = 0; d < 7; d++) {
    const dayCompletions = completions.filter(c => {
      const cDate = new Date(c.date);
      return cDate >= start28DaysAgo && cDate.getDay() === d;
    }).length;

    let dayScheduled = 0;
    // Over the last 28 days, each weekday occurs exactly 4 times
    for (let i = 0; i < 28; i++) {
      const checkDay = new Date(start28DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      if (checkDay.getDay() === d) {
        for (const h of habits) {
          const created = new Date(h.createdAt);
          const archived = h.archivedAt ? new Date(h.archivedAt) : null;
          const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
          if (created <= checkDay && (!archived || archived > checkDay)) {
            if (days.includes(d)) {
              dayScheduled++;
            }
          }
        }
      }
    }
    const rate = dayScheduled > 0 ? dayCompletions / dayScheduled : 0;
    ratesPerWeekday.push(rate);
  }

  const meanConsistency = ratesPerWeekday.reduce((sum, r) => sum + r, 0) / 7;
  const varianceConsistency = ratesPerWeekday.reduce((sum, r) => sum + Math.pow(r - meanConsistency, 2), 0) / 7;
  const scoreConsistency = Math.max(0, 100 - varianceConsistency * 400);

  // --- FACTOR 5: Comparison to Personal Best Period (10%) ---
  // Find highest rolling 7-day completions in the last 60 days
  let best7 = 0;
  // Sliding 7-day window over the 60-day range
  const numDaysRange = 60;
  for (let startOffset = 0; startOffset <= numDaysRange - 7; startOffset++) {
    const windowStart = new Date(start60DaysAgo.getTime() + startOffset * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const windowCompletions = completions.filter(c => {
      const cDate = new Date(c.date);
      return cDate >= windowStart && cDate < windowEnd;
    }).length;

    if (windowCompletions > best7) {
      best7 = windowCompletions;
    }
  }

  const start7DaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const current7 = completions.filter(c => new Date(c.date) >= start7DaysAgo).length;

  const scoreBest7 = best7 > 0
    ? Math.min(100, Math.max(0, (current7 / best7) * 100))
    : 100;

  // --- FINAL WEIGHTED MOMENTUM SCORE ---
  const score = scoreTrend * 0.30 +
                scoreStreak * 0.25 +
                scoreLogin * 0.20 +
                scoreConsistency * 0.15 +
                scoreBest7 * 0.10;

  return {
    score: parseFloat(score.toFixed(2)),
    scoreTrend: parseFloat(scoreTrend.toFixed(2)),
    scoreStreak: parseFloat(scoreStreak.toFixed(2)),
    scoreLogin: parseFloat(scoreLogin.toFixed(2)),
    scoreConsistency: parseFloat(scoreConsistency.toFixed(2)),
    scoreBest7: parseFloat(scoreBest7.toFixed(2)),
  };
}
