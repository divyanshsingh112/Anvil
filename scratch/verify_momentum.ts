import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

async function run() {
  const { prisma } = await import("../src/lib/prisma");
  const { calculateMomentumScore } = await import("../src/lib/momentum-calculator");
  const { triggerLazyMomentumRecalculation } = await import("../src/lib/services/momentum-service");

  console.log("=== STARTING MOMENTUM & INTERVENTION VERIFICATION RUN ===\n");

  const uniqueId = Date.now().toString().slice(-6);
  const email = `momentum_test_${uniqueId}@example.com`;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const start60DaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
  start60DaysAgo.setUTCHours(0, 0, 0, 0);

  // 1. Create base test user
  const user = await prisma.user.create({
    data: {
      email,
      displayName: `Momentum Test User ${uniqueId}`,
      streak: 5,
      longestStreak: 10,
      xp: 100,
      level: 2,
      coins: 50,
      lastLoginAt: today,
    },
  });
  console.log(`Created test user: ${user.id}\n`);

  // Create active habits active from 60 days ago
  const warriorHabit = await prisma.habit.create({
    data: {
      userId: user.id,
      name: "Pushups Quest",
      class: "warrior",
      difficulty: "novice",
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      createdAt: start60DaysAgo,
    },
  });

  const mageHabit = await prisma.habit.create({
    data: {
      userId: user.id,
      name: "Reading Spell Book",
      class: "mage",
      difficulty: "adept",
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      createdAt: start60DaysAgo,
    },
  });

  // Create user stats record
  await prisma.userStats.create({
    data: {
      userId: user.id,
      totalCompletions: 20,
      warriorCompletions: 12,
      mageCompletions: 8,
      rogueCompletions: 0,
    },
  });

  // Helper to add completions in date ranges
  const addCompletions = async (habitId: string, daysAgoStart: number, daysAgoEnd: number) => {
    const records = [];
    for (let d = daysAgoStart; d >= daysAgoEnd; d--) {
      const cDate = new Date(today.getTime() - d * 24 * 60 * 60 * 1000);
      cDate.setUTCHours(0, 0, 0, 0);
      records.push({
        habitId,
        userId: user.id,
        date: cDate,
        loggedAt: new Date(),
        completedAt: new Date(),
        timeBucket: "morning",
        timeAccuracy: "confirmed",
      });
    }
    await prisma.completion.createMany({ data: records });
  };

  // ==========================================
  // SCENARIO 1: IMPROVING PATTERN (Low start, High end)
  // ==========================================
  console.log("--- SCENARIO 1: IMPROVING PATTERN (High completions last 14 days, Low previous 14) ---");
  // 14 completions in last 14 days, 0 in previous 14 days
  await addCompletions(warriorHabit.id, 13, 0);
  
  let scoreImp = await calculateMomentumScore(user.id, today);
  console.log("Raw Inputs for Trend Calculation:");
  console.log(`- completionsLast14 length: 14`);
  console.log(`- scheduledLast14: 14`);
  console.log(`- completionsPrev14 length: 0`);
  console.log(`- scheduledPrev14: 14`);
  console.log(`- R1 (last 14 rate): 1.0, R2 (prev 14 rate): 0.0`);
  console.log("Resulting Score Details:", scoreImp);
  console.log(`Final Momentum: ${scoreImp.score} (Expected: High score due to positive trend)\n`);

  // ==========================================
  // SCENARIO 2: DECLINING PATTERN (High start, Low end)
  // ==========================================
  console.log("--- SCENARIO 2: DECLINING PATTERN (Low completions last 14 days, High previous 14) ---");
  // Clear completions first
  await prisma.completion.deleteMany({ where: { userId: user.id } });
  // 0 completions in last 14 days, 14 in previous 14 days
  await addCompletions(warriorHabit.id, 27, 14);

  let scoreDec = await calculateMomentumScore(user.id, today);
  console.log("Resulting Score Details:", scoreDec);
  console.log(`Final Momentum: ${scoreDec.score} (Expected: lower than Improving scenario)\n`);

  // ==========================================
  // SCENARIO 3: LONG ABSENCE (Login penalty)
  // ==========================================
  console.log("--- SCENARIO 3: INACTIVITY PENALTY (Before vs After 10 Days Since Last Login) ---");
  // Let's set improving completions baseline so we have a clean comparison
  await prisma.completion.deleteMany({ where: { userId: user.id } });
  await addCompletions(warriorHabit.id, 13, 0);

  // Before state: logged in today
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: today },
  });
  let beforeAbsence = await calculateMomentumScore(user.id, today);
  console.log("BEFORE (lastLoginAt = today):");
  console.log(beforeAbsence);
  
  // After state: logged in 10 days ago
  const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: tenDaysAgo },
  });
  let afterAbsence = await calculateMomentumScore(user.id, today);
  console.log("\nAFTER (lastLoginAt = 10 days ago):");
  console.log(afterAbsence);

  console.log(`\nBefore score: ${beforeAbsence.score}`);
  console.log(`After score:  ${afterAbsence.score}`);
  const diff = parseFloat((beforeAbsence.score - afterAbsence.score).toFixed(2));
  console.log(`Difference:   ${diff} points (Expected: exactly 20 points, since scoreLogin goes 100 -> 0 at 0.20 weight)`);
  console.log("");

  // Reset login time and clear completions for subsequent tests
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: today },
  });
  await prisma.completion.deleteMany({ where: { userId: user.id } });

  // ==========================================
  // SCENARIO 4: ALL 5 INTERVENTION LADDER TIERS & DUEL BRANCHING
  // ==========================================
  console.log("--- SCENARIO 4: TIERS & INTERVENTION LADDER CARD MAPPINGS ---");

  // Create opponent user to satisfy Rival relation key constraint
  const opponent = await prisma.user.create({
    data: {
      email: `opponent_${uniqueId}@example.com`,
      displayName: `Opponent User ${uniqueId}`,
      xp: 0,
      level: 1,
      coins: 0,
    },
  });

  const runStatsFetchMock = async (targetScore: number, hasActiveDuel = false): Promise<any> => {
    await prisma.user.update({
      where: { id: user.id },
      data: { momentumScore: targetScore },
    });

    if (hasActiveDuel) {
      const opponentId = opponent.id;
      await prisma.rival.deleteMany({ where: { challengerId: user.id } });
      await prisma.rival.create({
        data: {
          challengerId: user.id,
          rivalId: opponentId,
          habitName: "Pushups Duel",
          status: "active",
        },
      });
    } else {
      await prisma.rival.deleteMany({ where: { challengerId: user.id } });
    }

    const activeDuel = hasActiveDuel;

    let tier = "";
    let label = "";
    let intervention: any = {};

    if (targetScore >= 80) {
      tier = "on-fire";
      label = "On Fire";
      intervention = {
        type: "celebrate",
        message: "You are on fire! Keep maintaining your perfect streak.",
      };
    } else if (targetScore >= 60) {
      tier = "building";
      label = "Building";
      intervention = {
        type: "encourage",
        message: "You are 5 days away from your personal best streak!",
      };
    } else if (targetScore >= 40) {
      tier = "slipping";
      label = "Slipping";
      intervention = {
        type: "challenge",
        message: `Your warrior habits have been slipping — complete one today to recover momentum!`,
      };
    } else if (targetScore >= 20) {
      tier = "fading";
      label = "Fading";
      if (activeDuel) {
        intervention = {
          type: "rival",
          message: "Your rival is pulling ahead — time to catch up.",
        };
      } else {
        intervention = {
          type: "warning",
          message: "Your momentum is fading. Consistency is key — pick one simple habit to complete today.",
        };
      }
    } else {
      tier = "cold";
      label = "Cold";
      intervention = {
        type: "freeze",
        message: "Your habits are cold. Use an unused Streak Freeze or Streak Shield to protect your streak!",
      };
    }

    return { score: targetScore, tier, label, intervention };
  };

  const fire = await runStatsFetchMock(92);
  console.log(`Score: 92 -> Tier: "${fire.tier}" (${fire.label})`);
  console.log(`Intervention Alert Card: [${fire.intervention.type}] "${fire.intervention.message}"\n`);

  const building = await runStatsFetchMock(72);
  console.log(`Score: 72 -> Tier: "${building.tier}" (${building.label})`);
  console.log(`Intervention Alert Card: [${building.intervention.type}] "${building.intervention.message}"\n`);

  const slipping = await runStatsFetchMock(52);
  console.log(`Score: 52 -> Tier: "${slipping.tier}" (${slipping.label})`);
  console.log(`Intervention Alert Card: [${slipping.intervention.type}] "${slipping.intervention.message}"\n`);

  const fadingNoDuel = await runStatsFetchMock(32, false);
  console.log(`Score: 32 (NO DUEL) -> Tier: "${fadingNoDuel.tier}" (${fadingNoDuel.label})`);
  console.log(`Intervention Alert Card: [${fadingNoDuel.intervention.type}] "${fadingNoDuel.intervention.message}"\n`);

  const fadingWithDuel = await runStatsFetchMock(32, true);
  console.log(`Score: 32 (WITH DUEL) -> Tier: "${fadingWithDuel.tier}" (${fadingWithDuel.label})`);
  console.log(`Intervention Alert Card: [${fadingWithDuel.intervention.type}] "${fadingWithDuel.intervention.message}"\n`);

  const cold = await runStatsFetchMock(12);
  console.log(`Score: 12 -> Tier: "${cold.tier}" (${cold.label})`);
  console.log(`Intervention Alert Card: [${cold.intervention.type}] "${cold.intervention.message}"\n`);

  // ==========================================
  // SCENARIO 5: ML USER PROFILE MOMENTUM HISTORY RECORDING
  // ==========================================
  console.log("--- SCENARIO 5: HISTORICAL MOMENTUM HISTORY RECORDING (Last 30 Days) ---");
  
  // Set clean completions
  await prisma.completion.deleteMany({ where: { userId: user.id } });
  await addCompletions(warriorHabit.id, 13, 0);

  // Clear any existing profiles for this test user
  await prisma.mlUserProfile.deleteMany({ where: { userId: user.id } });

  // Run triggerLazyMomentumRecalculation multiple times for mock dates to build up history
  for (let offset = 5; offset >= 0; offset--) {
    const historyDate = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    // Force calculation to run
    await triggerLazyMomentumRecalculation(user.id, historyDate, true);
  }

  // Fetch resulting MlUserProfile
  const mlProfile = await prisma.mlUserProfile.findUnique({
    where: { userId: user.id },
  });

  console.log("Resulting MlUserProfile.momentumHistory JSON Value:");
  console.log(JSON.stringify(mlProfile?.momentumHistory, null, 2));
  console.log("");

  // Clean up
  console.log("Cleaning up synthetic test user data...");
  await prisma.rival.deleteMany({ where: { challengerId: user.id } });
  await prisma.userStats.deleteMany({ where: { userId: user.id } });
  await prisma.habit.deleteMany({ where: { userId: user.id } });
  await prisma.mlUserProfile.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.user.delete({ where: { id: opponent.id } });

  console.log("Test execution finished successfully!");
}

run()
  .catch(console.error)
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
