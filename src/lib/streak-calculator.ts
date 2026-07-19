import { Prisma } from "@prisma/client";

interface StreakResult {
  newStreak: number;
  changed: boolean;
}

/**
 * Calculates user's new streak upon completion of a habit.
 * This runs inside a Prisma transaction block.
 */
export async function calculateStreakOnCompletion(
  tx: Prisma.TransactionClient,
  userId: string,
  today: Date,
  currentStreak: number
): Promise<StreakResult> {
  // Count today's completions (since the write has already happened, this will be >= 1)
  const todayCompletionsCount = await tx.completion.count({
    where: { userId, date: today },
  });

  // If they already have other completions today, the streak was already updated/incremented
  if (todayCompletionsCount > 1) {
    return { newStreak: currentStreak, changed: false };
  }

  // First completion today. Check if they completed yesterday to increment or reset to 1
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const completedYesterday = await tx.completion.count({
    where: { userId, date: yesterday },
  });

  if (completedYesterday > 0) {
    return { newStreak: currentStreak + 1, changed: true };
  } else {
    return { newStreak: 1, changed: true };
  }
}

/**
 * Calculates user's new streak when a completion is deleted/un-toggled.
 * This runs inside a Prisma transaction block.
 */
export async function calculateStreakOnUncompletion(
  tx: Prisma.TransactionClient,
  userId: string,
  today: Date,
  currentStreak: number
): Promise<StreakResult> {
  // Count today's completions (since the deletion has already happened, this will be >= 0)
  const todayCompletionsCount = await tx.completion.count({
    where: { userId, date: today },
  });

  // If there are no completions left for today, the streak decrements
  if (todayCompletionsCount === 0) {
    return { newStreak: Math.max(0, currentStreak - 1), changed: true };
  }

  // Otherwise, they still have other completions today, so the streak remains unchanged
  return { newStreak: currentStreak, changed: false };
}

