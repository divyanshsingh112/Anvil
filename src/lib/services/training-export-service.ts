import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

/**
 * Calculates a deterministic, rotating random-looking string for a user's anonId
 * that rotates every 90 days. Uses a system secret so it cannot be matched
 * back to the user ID from the database alone.
 */
export function getAnonId(userId: string): string {
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const periodIndex = Math.floor(daysSinceEpoch / 90);
  const systemSecret = process.env.ANON_SYSTEM_SECRET;
  if (!systemSecret) {
    throw new Error(
      "ANON_SYSTEM_SECRET must be set — refusing to generate anonId with a fallback secret, since this would compromise the anonymization guarantee."
    );
  }

  return createHash("sha256")
    .update(`${userId}-${periodIndex}-${systemSecret}`)
    .digest("hex");
}

/**
 * Lazily triggers the export of an anonymized snapshot for a user if they consent.
 * Runs once per day per consenting user.
 */
export async function exportAnonymizedSnapshot(userId: string): Promise<any> {
  const { prisma } = await import("../prisma");

  // 1. Check consent first - EXPLICIT OPT-IN REQUIRED
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      trainingDataConsent: true,
      streak: true,
      lastLoginAt: true,
      momentumScore: true,
    },
  });

  if (!user || !user.trainingDataConsent) {
    // Abort immediately without touching any database query
    return null;
  }

  const anonId = getAnonId(userId);
  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const snapshotDate = new Date(todayStr); // Start of UTC day

  // 2. Check if a snapshot for this anonId and date already exists (lazy check, run once per day)
  const existing = await prisma.trainingDataSnapshot.findFirst({
    where: {
      anonId,
      snapshotDate,
    },
  });

  if (existing) {
    return existing; // Already exported today
  }

  // 3. Query stats and metadata
  const [stats, mlProfile, habits, completionsLast30] = await Promise.all([
    prisma.userStats.findUnique({ where: { userId } }),
    prisma.mlUserProfile.findUnique({ where: { userId } }),
    prisma.habit.findMany({
      where: {
        userId,
        archivedAt: null,
      },
    }),
    prisma.completion.findMany({
      where: {
        userId,
        date: {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  if (!stats) {
    return null; // Stats not initialized
  }

  // --- Calculate completionRateTrend over the last 14 days ---
  const completionsLast14 = completionsLast30.filter(
    (c) => c.date >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  );

  let activeHabitSlots = 0;
  const start14DaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < 14; i++) {
    const checkDay = new Date(start14DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = checkDay.getDay(); // 0 = Sunday, 1 = Monday...
    for (const h of habits) {
      const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
      if (days.includes(dayOfWeek)) {
        activeHabitSlots++;
      }
    }
  }

  const completionRateTrend = new Prisma.Decimal(
    activeHabitSlots > 0 ? completionsLast14.length / activeHabitSlots : 0
  );

  // --- Calculate weekdayVariance in the last 30 days ---
  const countsPerDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  for (const c of completionsLast30) {
    const day = new Date(c.date).getDay();
    countsPerDayOfWeek[day]++;
  }

  const mean = countsPerDayOfWeek.reduce((sum, val) => sum + val, 0) / 7;
  const variance = countsPerDayOfWeek.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 7;
  const weekdayVariance = new Prisma.Decimal(variance);

  // --- Aggregate timeOfDayBuckets ---
  const timeBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const c of completionsLast30) {
    const bucket = c.timeBucket as keyof typeof timeBuckets;
    if (bucket in timeBuckets) {
      timeBuckets[bucket]++;
    }
  }

  // --- Class Distribution Ratios ( r = classCompletions / totalCompletions ) ---
  const totalClassCompletions = stats.warriorCompletions + stats.mageCompletions + stats.rogueCompletions;
  const classDistribution = {
    warrior: totalClassCompletions > 0 ? stats.warriorCompletions / totalClassCompletions : 0,
    mage: totalClassCompletions > 0 ? stats.mageCompletions / totalClassCompletions : 0,
    rogue: totalClassCompletions > 0 ? stats.rogueCompletions / totalClassCompletions : 0,
  };

  // --- Difficulty Distribution Ratios ---
  let noviceCount = 0;
  let adeptCount = 0;
  let masterCount = 0;
  for (const h of habits) {
    if (h.difficulty === "novice") noviceCount++;
    else if (h.difficulty === "adept") adeptCount++;
    else if (h.difficulty === "master") masterCount++;
  }
  const totalHabits = habits.length;
  const difficultyDistribution = {
    novice: totalHabits > 0 ? noviceCount / totalHabits : 0,
    adept: totalHabits > 0 ? adeptCount / totalHabits : 0,
    master: totalHabits > 0 ? masterCount / totalHabits : 0,
  };

  // --- Days since last login ---
  let daysSinceLastLogin = 0;
  if (user.lastLoginAt) {
    const diff = now.getTime() - new Date(user.lastLoginAt).getTime();
    daysSinceLastLogin = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  // 4. Create snapshot row
  const snapshot = await prisma.trainingDataSnapshot.create({
    data: {
      anonId,
      snapshotDate,
      completionRateTrend,
      streakLength: user.streak,
      daysSinceLastLogin,
      weekdayVariance,
      timeOfDayBuckets: timeBuckets as any,
      classDistribution: classDistribution as any,
      difficultyDistribution: difficultyDistribution as any,
      momentumScore: user.momentumScore,
      archetypeLabel: mlProfile?.behavioralArchetype || null,
    },
  });

  return snapshot;
}
