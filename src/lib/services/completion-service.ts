import { Prisma, Completion } from "@prisma/client";
import { XP_PER_COMPLETION, COINS_PER_PERFECT_DAY, calculateLevel } from "@/lib/gamification-constants";
import { calculateStreakOnCompletion, calculateStreakOnUncompletion } from "@/lib/streak-calculator";
import { checkAndApplyStreakDecayAndRecharge } from "@/lib/streak-decay";
import { checkAchievements, UnlockedAchievement } from "@/lib/achievement-checker";
import { calculateAttributeScores } from "@/lib/attribute-calculator";

export interface ProcessToggleResult {
  completion: Completion | null;
  user: {
    xp: number;
    level: number;
    coins: number;
    streak: number;
    longestStreak: number;
    activeTheme: string;
    streakShieldActive: boolean;
    freeFreezeCharges: number;
    freezeActiveDate: Date | null;
  };
  leveledUp: boolean;
  perfectDay: boolean;
  newAchievements: UnlockedAchievement[];
  chainCompleted: {
    chainId: string;
    chainName: string;
    bonusXp: number;
  } | null;
}

/**
 * Orchestrates a complete habit toggle execution inside a Prisma transaction,
 * updating streaks, gamification progress, and checking achievements.
 */
export async function processCompletionToggle(
  tx: Prisma.TransactionClient,
  userId: string,
  habitId: string,
  completed: boolean,
  options?: {
    timeBucket?: string | null;
    timeAccuracy?: string | null;
    customCompletedAt?: string | null;
  }
): Promise<ProcessToggleResult> {
  let chainCompleted: { chainId: string; chainName: string; bonusXp: number } | null = null;

  // 1. Run lazy streak decay/recharge first so User table is in sync
  const initialUser = await checkAndApplyStreakDecayAndRecharge(tx, userId);
  if (!initialUser) {
    throw new Error("USER_NOT_FOUND");
  }

  // 2. Fetch the habit and verify ownership
  const habit = await tx.habit.findFirst({
    where: { id: habitId, userId },
  });
  if (!habit) {
    throw new Error("HABIT_NOT_FOUND");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dateVal = now.getDate();
  const today = new Date(Date.UTC(year, month, dateVal));
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Check existing completion for today
  const existingCompletion = await tx.completion.findFirst({
    where: { habitId, userId, date: today },
  });

  // Fetch current user stats
  const user = await tx.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  let completion: Completion | null = null;
  let newXp = Number(user.xp);
  let newLevel = user.level;
  let newCoins = user.coins;
  let newStreak = user.streak;
  let newLongestStreak = user.longestStreak;
  let perfectDay = false;

  const difficulty = habit.difficulty as keyof typeof XP_PER_COMPLETION;
  const xpReward = XP_PER_COMPLETION[difficulty] || 10;

  if (completed) {
    if (existingCompletion) {
      // Already completed today, do not award rewards again but update time info
      const derivedTimeBucket = options?.timeBucket;
      const derivedTimeAccuracy = options?.timeAccuracy || "skip";
      let completedAtDate = now;

      if (derivedTimeAccuracy === "confirmed") {
        if (options?.customCompletedAt) {
          const parsed = new Date(options.customCompletedAt);
          if (!isNaN(parsed.getTime())) completedAtDate = parsed;
        }
      }

      completion = await tx.completion.update({
        where: { id: existingCompletion.id },
        data: {
          loggedAt: now,
          completedAt: completedAtDate,
          timeBucket: derivedTimeBucket || existingCompletion.timeBucket,
          timeAccuracy: derivedTimeAccuracy,
        },
      });
    } else {
      // New completion today!
      let derivedTimeBucket = options?.timeBucket;
      let derivedTimeAccuracy = options?.timeAccuracy || "skip";
      let completedAtDate = now;

      if (derivedTimeAccuracy === "confirmed") {
        if (options?.customCompletedAt) {
          const parsed = new Date(options.customCompletedAt);
          if (!isNaN(parsed.getTime())) completedAtDate = parsed;
        }
        if (!derivedTimeBucket) {
          const hour = completedAtDate.getHours();
          if (hour >= 5 && hour <= 11) derivedTimeBucket = "morning";
          else if (hour >= 12 && hour <= 16) derivedTimeBucket = "afternoon";
          else if (hour >= 17 && hour <= 21) derivedTimeBucket = "evening";
          else derivedTimeBucket = "night";
        }
      } else if (derivedTimeAccuracy === "estimated") {
        completedAtDate = now;
        if (!derivedTimeBucket) derivedTimeBucket = "morning";
      } else {
        derivedTimeAccuracy = "skip";
        completedAtDate = now;
        const hour = now.getHours();
        if (hour >= 5 && hour <= 11) derivedTimeBucket = "morning";
        else if (hour >= 12 && hour <= 16) derivedTimeBucket = "afternoon";
        else if (hour >= 17 && hour <= 21) derivedTimeBucket = "evening";
        else derivedTimeBucket = "night";
      }

      completion = await tx.completion.create({
        data: {
          habitId,
          userId,
          date: today,
          loggedAt: now,
          completedAt: completedAtDate,
          timeBucket: derivedTimeBucket || "morning",
          timeAccuracy: derivedTimeAccuracy,
        },
      });

      // Query today's completions *once* to get all completed habit IDs
      const todayCompletions = await tx.completion.findMany({
        where: { userId, date: today },
        select: { habitId: true },
      });
      const completedHabitIds = new Set(
        todayCompletions.map((c: { habitId: string }) => c.habitId)
      );

      // Increment XP
      newXp = newXp + xpReward;
      newLevel = calculateLevel(newXp);

      // Recalculate Streak
      const streakCalc = await calculateStreakOnCompletion(tx, userId, today, user.streak);
      newStreak = streakCalc.newStreak;
      if (newStreak > user.longestStreak) {
        newLongestStreak = newStreak;
      }

      // Check Quest Chains completion (avoid re-awarding if already completed today)
      const userChains = await tx.questChain.findMany({
        where: { userId },
      });
      const matchingChains = userChains.filter((c: { habitIds: string[] }) =>
        c.habitIds.includes(habitId)
      );

      for (const chain of matchingChains) {
        const alreadyCompletedToday = chain.lastCompletedDay &&
          new Date(chain.lastCompletedDay).getTime() === today.getTime();

        if (alreadyCompletedToday) {
          continue;
        }

        const allHabitsCompleted = chain.habitIds.every((id) => completedHabitIds.has(id));

        if (allHabitsCompleted) {
          newXp = newXp + chain.bonusXp;
          newLevel = calculateLevel(newXp);

          await tx.questChain.update({
            where: { id: chain.id },
            data: { lastCompletedDay: today },
          });

          chainCompleted = {
            chainId: chain.id,
            chainName: chain.name,
            bonusXp: chain.bonusXp,
          };
          break;
        }
      }

      // Check perfect day bonus (reusing the loaded completions set)
      perfectDay = await checkPerfectDayCondition(tx, userId, today, currentDayOfWeek, completedHabitIds);
      if (perfectDay) {
        newCoins = newCoins + COINS_PER_PERFECT_DAY;
      }

      // Update UserStats table
      await updateUserStatsOnCompletion(tx, userId, habit.class, today, perfectDay);

      // Recalculate attribute scores (uses data already in the transaction)
      await recalculateAttributeScores(tx, userId, newStreak, newLongestStreak);

      // Hook into Rival System to increment active duel counts
      const { handleHabitToggle } = await import("./rival-service");
      await handleHabitToggle(tx, userId, habitId, true);
    }
  } else {
    // Toggle incomplete (un-toggle)
    if (!existingCompletion) {
      // Already uncompleted, return current state
      return {
        completion: null,
        user: {
          xp: Number(user.xp),
          level: user.level,
          coins: user.coins,
          streak: user.streak,
          longestStreak: user.longestStreak,
          activeTheme: user.activeTheme,
          streakShieldActive: user.streakShieldActive,
          freeFreezeCharges: user.freeFreezeCharges,
          freezeActiveDate: user.freezeActiveDate,
        },
        leveledUp: false,
        perfectDay: false,
        newAchievements: [],
        chainCompleted: null,
      };
    }

    // Delete completion row
    await tx.completion.delete({
      where: { id: existingCompletion.id },
    });

    // Subtract XP
    newXp = Math.max(0, newXp - xpReward);
    newLevel = calculateLevel(newXp);

    // Recalculate Streak on Uncompletion
    const streakCalc = await calculateStreakOnUncompletion(tx, userId, today, user.streak);
    newStreak = streakCalc.newStreak;

    // Update UserStats counter (decrement)
    await updateUserStatsOnUncompletion(tx, userId, habit.class);

    // Recalculate attribute scores after decrement
    await recalculateAttributeScores(tx, userId, newStreak, user.longestStreak);

    // Hook into Rival System to decrement active duel counts
    const { handleHabitToggle } = await import("./rival-service");
    await handleHabitToggle(tx, userId, habitId, false);
  }

  // Save the updated user values
  await tx.user.update({
    where: { id: userId },
    data: {
      xp: newXp,
      level: newLevel,
      coins: newCoins,
      streak: newStreak,
      longestStreak: newLongestStreak,
    },
  });

  // Check achievements
  const newAchievements = await checkAchievements(tx, userId, "completion");

  // Refetch final user record since achievement checks might have updated level/XP
  const finalUser = await tx.user.findUnique({
    where: { id: userId },
  });
  if (!finalUser) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    completion,
    user: {
      xp: Number(finalUser.xp),
      level: finalUser.level,
      coins: finalUser.coins,
      streak: finalUser.streak,
      longestStreak: finalUser.longestStreak,
      activeTheme: finalUser.activeTheme,
      streakShieldActive: finalUser.streakShieldActive,
      freeFreezeCharges: finalUser.freeFreezeCharges,
      freezeActiveDate: finalUser.freezeActiveDate,
    },
    leveledUp: finalUser.level > initialUser.level,
    perfectDay,
    newAchievements,
    chainCompleted,
  };
}

/**
 * Checks if completing a habit today completes all scheduled active habits for today.
 */
async function checkPerfectDayCondition(
  tx: Prisma.TransactionClient,
  userId: string,
  today: Date,
  currentDayOfWeek: number,
  completedHabitIds: Set<string>
): Promise<boolean> {
  const stats = await tx.userStats.findUnique({
    where: { userId },
  });

  const alreadyPerfectToday = stats?.lastPerfectDay &&
    new Date(stats.lastPerfectDay).getTime() === today.getTime();

  if (alreadyPerfectToday) {
    return false; // Already claimed perfect day today
  }

  // Find all non-archived habits for this month
  const monthHabits = await tx.habit.findMany({
    where: {
      userId,
      year: today.getUTCFullYear(),
      month: today.getUTCMonth() + 1,
      archivedAt: null,
    },
  });

  // Filter to only those scheduled for today
  const todayScheduledHabits = monthHabits.filter((h: { scheduledDays: number[] }) => {
    const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
    return days.includes(currentDayOfWeek);
  });

  return (
    todayScheduledHabits.length > 0 &&
    completedHabitIds.size === todayScheduledHabits.length
  );
}

/**
 * Updates UserStats counts when a habit is completed.
 */
async function updateUserStatsOnCompletion(
  tx: Prisma.TransactionClient,
  userId: string,
  habitClass: string,
  today: Date,
  perfectDay: boolean
): Promise<void> {
  const classField = `${habitClass}Completions` as "warriorCompletions" | "mageCompletions" | "rogueCompletions";
  const updateStatsData: Prisma.UserStatsUpdateInput = {
    totalCompletions: { increment: 1 },
    [classField]: { increment: 1 },
  };

  if (perfectDay) {
    updateStatsData.perfectDays = { increment: 1 };
    updateStatsData.lastPerfectDay = today;
  }

  await tx.userStats.upsert({
    where: { userId },
    create: {
      userId,
      totalCompletions: 1,
      [classField]: 1,
      perfectDays: perfectDay ? 1 : 0,
      lastPerfectDay: perfectDay ? today : null,
    },
    update: updateStatsData,
  });
}

/**
 * Decrements UserStats counts when a completion is removed (uncompleted).
 */
async function updateUserStatsOnUncompletion(
  tx: Prisma.TransactionClient,
  userId: string,
  habitClass: string
): Promise<void> {
  const stats = await tx.userStats.findUnique({
    where: { userId },
  });

  if (stats) {
    const classField = `${habitClass}Completions` as "warriorCompletions" | "mageCompletions" | "rogueCompletions";
    const currentClassCompletions = Number(stats[classField] || 0);

    await tx.userStats.update({
      where: { userId },
      data: {
        totalCompletions: Math.max(0, stats.totalCompletions - 1),
        [classField]: Math.max(0, currentClassCompletions - 1),
      },
    });
  }
}

/**
 * Recalculates STR/INT/WIS/CHA attribute scores on UserStats.
 *
 * Uses data already present in the transaction (class completion counters
 * from UserStats, streak data from the User record). No new expensive queries.
 */
async function recalculateAttributeScores(
  tx: Prisma.TransactionClient,
  userId: string,
  currentStreak: number,
  longestStreak: number
): Promise<void> {
  const stats = await tx.userStats.findUnique({
    where: { userId },
  });

  if (!stats) return;

  const scores = calculateAttributeScores({
    warriorCompletions: stats.warriorCompletions,
    mageCompletions: stats.mageCompletions,
    rogueCompletions: stats.rogueCompletions,
    totalCompletions: stats.totalCompletions,
    streak: currentStreak,
    longestStreak,
    // Overall completion rate is expensive to compute here (needs habit query).
    // For the in-transaction update, we use a simplified estimate based on
    // the data we have. The /api/user/attributes endpoint computes the
    // accurate rate when the radar chart is loaded.
    overallCompletionRate: 50, // neutral default — CHA is a placeholder anyway
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
