import { Prisma } from "@prisma/client";
import { checkAchievements } from "../achievement-checker";

/**
 * Recalculates STR/INT/WIS/CHA attribute scores on UserStats.
 * Incorporates the new blended formula for CHA:
 * 60% based on consistency (streak and completion rate),
 * 40% based on rival win/loss rate once duel history exists.
 */
export async function recalculateUserAttributes(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  const [stats, user] = await Promise.all([
    tx.userStats.findUnique({ where: { userId } }),
    tx.user.findUnique({ where: { id: userId } }),
  ]);

  if (!stats || !user) return;

  const { calculateAttributeScores } = await import("../attribute-calculator");
  const scores = calculateAttributeScores({
    warriorCompletions: stats.warriorCompletions,
    mageCompletions: stats.mageCompletions,
    rogueCompletions: stats.rogueCompletions,
    totalCompletions: stats.totalCompletions,
    streak: user.streak,
    longestStreak: user.longestStreak,
    overallCompletionRate: 50, // default placeholder for inside transaction
    rivalWins: stats.rivalWins,
    rivalLosses: stats.rivalLosses,
    rivalTies: stats.rivalTies,
  });

  await tx.userStats.update({
    where: { userId },
    data: {
      strScore: scores.strScore,
      intScore: scores.intScore,
      wisScore: scores.wisScore,
      chaScore: scores.chaScore,
    },
  });
}

/**
 * Creates a new pending challenge from a challenger user to a rival user.
 */
export async function createChallenge(
  tx: Prisma.TransactionClient,
  challengerId: string,
  habitId: string,
  habitName: string,
  rivalUsernameOrEmail: string
) {
  // 1. Verify habit ownership
  const habit = await tx.habit.findFirst({
    where: { id: habitId, userId: challengerId, archivedAt: null },
  });
  if (!habit) {
    throw new Error("HABIT_NOT_FOUND");
  }

  // 2. Find target user
  const rival = await tx.user.findFirst({
    where: {
      OR: [
        { email: { equals: rivalUsernameOrEmail, mode: "insensitive" } },
        { displayName: { equals: rivalUsernameOrEmail, mode: "insensitive" } },
      ],
    },
  });
  if (!rival) {
    throw new Error("RIVAL_NOT_FOUND");
  }

  // 3. Prevent self-challenges
  if (rival.id === challengerId) {
    throw new Error("CANNOT_CHALLENGE_SELF");
  }

  // 4. Check if an active or pending challenge on this habit already exists
  const existing = await tx.rival.findFirst({
    where: {
      challengerId,
      rivalId: rival.id,
      habitName,
      status: { in: ["pending", "active"] },
    },
  });
  if (existing) {
    throw new Error("DUEL_ALREADY_EXISTS");
  }

  // 5. Create pending challenge
  return await tx.rival.create({
    data: {
      challengerId,
      rivalId: rival.id,
      habitName,
      challengerHabitId: habitId,
      status: "pending",
      challengerCount: 0,
      rivalCount: 0,
      challengerSeen: false,
      rivalSeen: false,
    },
  });
}

/**
 * Responds to a pending challenge by accepting or declining it.
 */
export async function respondToChallenge(
  tx: Prisma.TransactionClient,
  rivalId: string,
  challengeId: string,
  action: "accept" | "decline",
  habitId?: string
) {
  const challenge = await tx.rival.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new Error("CHALLENGE_NOT_FOUND");
  }

  if (challenge.rivalId !== rivalId) {
    throw new Error("UNAUTHORIZED");
  }

  if (challenge.status !== "pending") {
    throw new Error("CHALLENGE_NOT_PENDING");
  }

  if (action === "decline") {
    return await tx.rival.update({
      where: { id: challengeId },
      data: { status: "declined" },
    });
  }

  // Action is accept
  if (!habitId) {
    throw new Error("HABIT_REQUIRED");
  }

  // Verify habit ownership for the responder
  const habit = await tx.habit.findFirst({
    where: { id: habitId, userId: rivalId, archivedAt: null },
  });
  if (!habit) {
    throw new Error("HABIT_NOT_FOUND");
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return await tx.rival.update({
    where: { id: challengeId },
    data: {
      status: "active",
      startDate,
      endDate,
      rivalHabitId: habitId,
    },
  });
}

/**
 * Increments or decrements active duel counts when a user completes or un-completes a habit.
 */
export async function handleHabitToggle(
  tx: Prisma.TransactionClient,
  userId: string,
  habitId: string,
  completed: boolean
): Promise<void> {
  const now = new Date();

  // Find active duels that cover this habit for this user
  const activeDuels = await tx.rival.findMany({
    where: {
      status: "active",
      OR: [
        { challengerId: userId, challengerHabitId: habitId },
        { rivalId: userId, rivalHabitId: habitId },
      ],
      endDate: { gte: now }, // still active
    },
  });

  for (const duel of activeDuels) {
    if (duel.challengerId === userId && duel.challengerHabitId === habitId) {
      const newCount = completed
        ? duel.challengerCount + 1
        : Math.max(0, duel.challengerCount - 1);

      await tx.rival.update({
        where: { id: duel.id },
        data: { challengerCount: newCount },
      });
    } else if (duel.rivalId === userId && duel.rivalHabitId === habitId) {
      const newCount = completed
        ? duel.rivalCount + 1
        : Math.max(0, duel.rivalCount - 1);

      await tx.rival.update({
        where: { id: duel.id },
        data: { rivalCount: newCount },
      });
    }
  }
}

/**
 * Lazily resolves active duels whose end dates have passed.
 * Computes the winner, updates user stats, and flags notifications.
 */
export async function resolvePendingDuels(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  const now = new Date();

  const expiredDuels = await tx.rival.findMany({
    where: {
      status: "active",
      endDate: { lte: now },
      OR: [
        { challengerId: userId },
        { rivalId: userId },
      ],
    },
  });

  for (const duel of expiredDuels) {
    let winnerId: string | null = null;
    let loserId: string | null = null;
    let isTie = false;

    if (duel.challengerCount > duel.rivalCount) {
      winnerId = duel.challengerId;
      loserId = duel.rivalId;
    } else if (duel.rivalCount > duel.challengerCount) {
      winnerId = duel.rivalId;
      loserId = duel.challengerId;
    } else {
      isTie = true;
    }

    // Update the duel status to completed
    await tx.rival.update({
      where: { id: duel.id },
      data: {
        status: "completed",
        winnerId,
        challengerSeen: false,
        rivalSeen: false,
      },
    });

    if (isTie) {
      await tx.userStats.upsert({
        where: { userId: duel.challengerId },
        create: { userId: duel.challengerId, rivalTies: 1 },
        update: { rivalTies: { increment: 1 } },
      });
      await tx.userStats.upsert({
        where: { userId: duel.rivalId },
        create: { userId: duel.rivalId, rivalTies: 1 },
        update: { rivalTies: { increment: 1 } },
      });

      await recalculateUserAttributes(tx, duel.challengerId);
      await recalculateUserAttributes(tx, duel.rivalId);
    } else {
      // Award wins and losses
      await tx.userStats.upsert({
        where: { userId: winnerId! },
        create: { userId: winnerId!, rivalWins: 1 },
        update: { rivalWins: { increment: 1 } },
      });

      await tx.userStats.upsert({
        where: { userId: loserId! },
        create: { userId: loserId!, rivalLosses: 1 },
        update: { rivalLosses: { increment: 1 } },
      });

      // Recalculate attributes
      await recalculateUserAttributes(tx, winnerId!);
      await recalculateUserAttributes(tx, loserId!);

      // Check achievements for winner
      await checkAchievements(tx, winnerId!, "rival");
    }
  }
}
