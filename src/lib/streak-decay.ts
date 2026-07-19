import { Prisma, User } from "@prisma/client";

/**
 * Lazy-checks and applies:
 * 1. Day-over-day streak decay (resets streak if yesterday was missed and no freeze/shield protects it).
 * 2. Monthly Streak Shield recharge (grants 1 free charge if streak >= 30).
 * 3. Enforces that if streak drops below 30, shield remains active but we only recharge if streak remains >= 30.
 * 
 * This runs inside a Prisma transaction block.
 */
export async function checkAndApplyStreakDecayAndRecharge(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<User | null> {
  const now = new Date();
  // Standardize today and yesterday exactly like toggle completions route (UTC midnight start)
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  // 1. Fetch current user state
  let user = await tx.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  // 2. Monthly Streak Shield Recharge Check
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  let needsRecharge = false;
  if (user.streakShieldActive && user.streak >= 30) {
    if (!user.lastShieldRecharge) {
      needsRecharge = true;
    } else {
      const lastRechargeDate = new Date(user.lastShieldRecharge);
      const lastYear = lastRechargeDate.getFullYear();
      const lastMonth = lastRechargeDate.getMonth() + 1;
      
      if (currentYear > lastYear || (currentYear === lastYear && currentMonth > lastMonth)) {
        needsRecharge = true;
      }
    }
  }

  if (needsRecharge) {
    user = await tx.user.update({
      where: { id: userId },
      data: {
        freeFreezeCharges: { increment: 1 },
        lastShieldRecharge: now,
      },
    });
    console.log(`[Streak Shield] Recharged 1 free charge for user ${userId}. Charges: ${user.freeFreezeCharges}`);
  }

  // If user has already completed a habit today, the decay check for yesterday has already been resolved for today.
  const todayCompletionsCount = await tx.completion.count({
    where: { userId, date: today },
  });
  if (todayCompletionsCount > 0) {
    return user;
  }

  // 3. Day-over-day Streak Decay Check
  // Check if they completed any habits yesterday
  const yesterdayCompletionsCount = await tx.completion.count({
    where: { userId, date: yesterday },
  });

  if (yesterdayCompletionsCount === 0 && user.streak > 0) {
    let freezeProtected = false;

    // Check manual freeze: was a freeze item used and active on yesterday's date?
    if (user.freezeActiveDate) {
      const activeFreezeDate = new Date(user.freezeActiveDate);
      const freezeTime = Date.UTC(activeFreezeDate.getFullYear(), activeFreezeDate.getMonth(), activeFreezeDate.getDate());
      
      if (freezeTime === yesterday.getTime()) {
        freezeProtected = true;
        // Consume/clear manual freeze active date so it isn't reusable
        user = await tx.user.update({
          where: { id: userId },
          data: { freezeActiveDate: null },
        });
        console.log(`[Streak Freeze] Preserved streak of ${user.streak} using manual freeze.`);
      }
    }

    // Check automatic shield: shield active and has free charges left
    if (!freezeProtected && user.streakShieldActive && user.freeFreezeCharges > 0) {
      freezeProtected = true;
      user = await tx.user.update({
        where: { id: userId },
        data: {
          freeFreezeCharges: { decrement: 1 },
        },
      });
      console.log(`[Streak Shield] Preserved streak of ${user.streak} using 1 free charge. Remaining: ${user.freeFreezeCharges}`);
    }

    if (!freezeProtected) {
      // Break the streak! Streak resets to 0, shield resets to inactive
      user = await tx.user.update({
        where: { id: userId },
        data: {
          streak: 0,
          streakShieldActive: false,
        },
      });
      console.log(`[Streak Decay] Streak reset to 0 for user ${userId} because yesterday had 0 completions.`);
    }
  }

  return user;
}
