import { calculateMomentumScore } from "../momentum-calculator";

interface MomentumHistoryEntry {
  date: string;
  score: number;
}

/**
 * Triggers a daily lazy recalculation of user momentum.
 * Only recalculates if it hasn't run yet today, unless `force` is set to true.
 */
export async function triggerLazyMomentumRecalculation(
  userId: string,
  todayInput?: Date,
  force = false
): Promise<{ score: number; recalculated: boolean }> {
  const { prisma } = await import("../prisma");

  const today = todayInput ? new Date(todayInput) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  // 1. Fetch current profile
  let profile = await prisma.mlUserProfile.findUnique({
    where: { userId },
  });

  // Check if we already calculated today
  if (profile && profile.lastComputedAt && !force) {
    const lastDate = new Date(profile.lastComputedAt);
    const lastDateStr = `${lastDate.getUTCFullYear()}-${String(lastDate.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDate.getUTCDate()).padStart(2, "0")}`;
    if (lastDateStr === todayStr) {
      // Already calculated today, load existing score from user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { momentumScore: true },
      });
      return {
        score: user ? Number(user.momentumScore) : 100,
        recalculated: false,
      };
    }
  }

  // 2. Perform momentum score calculation
  const calculations = await calculateMomentumScore(userId, today);
  const score = calculations.score;

  // 3. Update User table
  await prisma.user.update({
    where: { id: userId },
    data: {
      momentumScore: score,
    },
  });

  // 4. Update/Create MlUserProfile table
  let history: MomentumHistoryEntry[] = [];
  if (profile && profile.momentumHistory) {
    try {
      const parsed = typeof profile.momentumHistory === "string" 
        ? JSON.parse(profile.momentumHistory) 
        : profile.momentumHistory;
      if (Array.isArray(parsed)) {
        history = parsed as MomentumHistoryEntry[];
      }
    } catch (e) {
      console.error("Error parsing momentumHistory JSON:", e);
    }
  }

  // Filter out any existing record for today's date to avoid double-logging
  history = history.filter((h) => h.date !== todayStr);

  // Append today's result
  history.push({ date: todayStr, score });

  // Limit list to last 30 entries
  history = history.slice(-30);

  if (profile) {
    await prisma.mlUserProfile.update({
      where: { userId },
      data: {
        momentumHistory: history as any,
        lastComputedAt: today,
      },
    });
  } else {
    await prisma.mlUserProfile.create({
      data: {
        userId,
        momentumHistory: history as any,
        lastComputedAt: today,
      },
    });
  }

  return { score, recalculated: true };
}
