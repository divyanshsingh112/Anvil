import { Prisma } from "@prisma/client";

export interface UnlockedAchievement {
  key: string;
  name: string;
  xpReward: number;
  icon: string;
}

/**
 * Checks and awards achievements that the user qualifies for.
 * This runs inside a Prisma transaction block.
 */
export async function checkAchievements(
  tx: Prisma.TransactionClient,
  userId: string,
  eventType: "completion"
): Promise<UnlockedAchievement[]> {
  if (eventType !== "completion") {
    return []; // Sprint 3/4 achievements stay locked automatically
  }

  // 1. Fetch user and stats
  const user = await tx.user.findUnique({
    where: { id: userId }
  });

  const stats = await tx.userStats.findUnique({
    where: { userId }
  });

  if (!user) return [];

  // 2. Fetch all achievement definitions
  const allAchievements = await tx.achievement.findMany();

  // 3. Find achievements already unlocked by this user
  const alreadyUnlocked = await tx.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true }
  });
  const unlockedIds = new Set(alreadyUnlocked.map((a) => a.achievementId));

  const newlyUnlocked: UnlockedAchievement[] = [];

  // 4. Evaluate each achievement
  for (const ach of allAchievements) {
    if (unlockedIds.has(ach.id)) {
      continue; // Skip already unlocked achievements
    }

    let isUnlocked = false;

    switch (ach.key) {
      case "streak_3":
        isUnlocked = user.streak >= 3;
        break;
      case "streak_7":
        isUnlocked = user.streak >= 7;
        break;
      case "streak_30":
        isUnlocked = user.streak >= 30;
        break;
      case "first_levelup":
        isUnlocked = user.level >= 2;
        break;
      case "level_10":
        isUnlocked = user.level >= 10;
        break;
      case "level_25":
        isUnlocked = user.level >= 25;
        break;
      case "iron_mage":
        isUnlocked = stats ? stats.mageCompletions >= 100 : false;
        break;
      case "iron_warrior":
        isUnlocked = stats ? stats.warriorCompletions >= 100 : false;
        break;
      case "iron_rogue":
        isUnlocked = stats ? stats.rogueCompletions >= 100 : false;
        break;
      case "perfect_week":
        isUnlocked = await checkPerfectWeek(tx, userId);
        break;
      default:
        // Sprint 3/4 achievements (chain_master, rival_winner, rival_dominator, momentum_100, comeback_kid)
        // behave as dead code that never fires because their underlying triggers are unimplemented.
        isUnlocked = false;
        break;
    }

    if (isUnlocked) {
      // Create UserAchievement row to prevent double unlocks
      await tx.userAchievement.create({
        data: {
          userId,
          achievementId: ach.id
        }
      });

      // Award XP using same level math
      const newXp = user.xp + ach.xpReward;
      const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

      await tx.user.update({
        where: { id: userId },
        data: {
          xp: newXp,
          level: newLevel
        }
      });

      newlyUnlocked.push({
        key: ach.key,
        name: ach.name,
        xpReward: ach.xpReward,
        icon: ach.icon
      });

      // Update local state copy so subsequent achievement checks see the updated level/XP
      user.xp = newXp;
      user.level = newLevel;
    }
  }

  return newlyUnlocked;
}

/**
 * Helper to query last 7 calendar days and assert that all active habits were completed each day.
 */
async function checkPerfectWeek(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dayOfWeek = checkDate.getUTCDay();

    // 1. Get habits active on checkDate
    const habits = await tx.habit.findMany({
      where: {
        userId,
        createdAt: { lte: checkDate },
        OR: [
          { archivedAt: null },
          { archivedAt: { gt: checkDate } }
        ]
      }
    });

    const activeHabits = habits.filter((h) => {
      if (!h.activeDays || h.activeDays.length === 0) return true;
      return h.activeDays.includes(dayOfWeek);
    });

    if (activeHabits.length === 0) {
      return false; // must have at least one active habit to constitute a perfect day
    }

    // 2. Count completions on checkDate
    const completionsCount = await tx.completion.count({
      where: {
        userId,
        date: checkDate
      }
    });

    if (completionsCount < activeHabits.length) {
      return false; // broken consecutive streak
    }
  }

  return true;
}
