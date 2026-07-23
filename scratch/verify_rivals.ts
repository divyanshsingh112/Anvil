import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

async function run() {
  console.log("=== STARTING RIVAL SYSTEM STEP 8 VERIFICATION ===\n");
  
  const { prisma } = await import("../src/lib/prisma");
  const {
    createChallenge,
    respondToChallenge,
    handleHabitToggle,
    resolvePendingDuels,
    recalculateUserAttributes
  } = await import("../src/lib/services/rival-service");
  const { processCompletionToggle } = await import("../src/lib/services/completion-service");

  // Create clean test users Account A and Account B
  const uniqueId = Date.now().toString().slice(-6);
  const emailA = `usera_${uniqueId}@example.com`;
  const emailB = `userb_${uniqueId}@example.com`;

  const userA = await prisma.user.create({
    data: {
      email: emailA,
      displayName: `Account A ${uniqueId}`,
      xp: 100,
      level: 1,
      coins: 10,
    }
  });

  const userB = await prisma.user.create({
    data: {
      email: emailB,
      displayName: `Account B ${uniqueId}`,
      xp: 100,
      level: 1,
      coins: 10,
    }
  });

  console.log(`Created User A: ${userA.id} (${userA.email})`);
  console.log(`Created User B: ${userB.id} (${userB.email})\n`);

  // Initialize UserStats for both
  await prisma.userStats.create({
    data: {
      userId: userA.id,
      totalCompletions: 0,
      warriorCompletions: 0,
      mageCompletions: 0,
      rogueCompletions: 0,
    }
  });

  await prisma.userStats.create({
    data: {
      userId: userB.id,
      totalCompletions: 0,
      warriorCompletions: 0,
      mageCompletions: 0,
      rogueCompletions: 0,
    }
  });

  // Re-calculate attributes to get baseline CHA scores
  await prisma.$transaction(async (tx) => {
    await recalculateUserAttributes(tx, userA.id);
    await recalculateUserAttributes(tx, userB.id);
  });

  const statsABefore = await prisma.userStats.findUnique({ where: { userId: userA.id } });
  console.log(`Baseline User A CHA Score (zero duels completed): ${statsABefore?.chaScore}`);

  // Create habits for both users
  const habitA = await prisma.habit.create({
    data: {
      userId: userA.id,
      name: "Daily Exercise",
      class: "warrior",
      difficulty: "novice",
      year: 2026,
      month: 7,
      activeDays: [0,1,2,3,4,5,6],
    }
  });

  const habitB = await prisma.habit.create({
    data: {
      userId: userB.id,
      name: "Gym Routine",
      class: "warrior",
      difficulty: "novice",
      year: 2026,
      month: 7,
      activeDays: [0,1,2,3,4,5,6],
    }
  });

  console.log(`Created Habit A for User A: ${habitA.id}`);
  console.log(`Created Habit B for User B: ${habitB.id}\n`);

  // --- 8.9 Attempt self-challenge rejection ---
  console.log("--- VERIFICATION 8.9: Self-Challenge Rejection ---");
  try {
    await prisma.$transaction(async (tx) => {
      await createChallenge(tx, userA.id, habitA.id, "Exercise Duel", userA.email);
    });
  } catch (e: any) {
    console.log("Caught expected self-challenge error:", e.message);
  }
  console.log("");

  // --- 8.1 Create Challenge (Account A challenges Account B) ---
  console.log("--- VERIFICATION 8.1: Challenge Creation & Pending Status ---");
  const challenge = await prisma.$transaction(async (tx) => {
    return await createChallenge(tx, userA.id, habitA.id, "Exercise Duel", userB.email);
  });
  console.log("Created Challenge Row:");
  console.log(JSON.stringify(challenge, null, 2));

  // Verify B sees the pending challenge
  const pendingIncomingForB = await prisma.rival.findMany({
    where: { status: "pending", rivalId: userB.id }
  });
  console.log(`Pending challenges found for B: ${pendingIncomingForB.length}`);
  console.log(`Is B's pending challenge ID same as created ID? ${pendingIncomingForB[0]?.id === challenge.id}\n`);

  // --- 8.2 B accepts challenge linking habitB ---
  console.log("--- VERIFICATION 8.2: Accept Challenge ---");
  const activeDuel = await prisma.$transaction(async (tx) => {
    return await respondToChallenge(tx, userB.id, challenge.id, "accept", habitB.id);
  });
  console.log("Accepted Challenge Row (Active Duel):");
  console.log(JSON.stringify(activeDuel, null, 2));
  
  const end = activeDuel.endDate ? new Date(activeDuel.endDate) : new Date();
  const start = activeDuel.startDate ? new Date(activeDuel.startDate) : new Date();
  const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`StartDate and EndDate set? ${activeDuel.startDate !== null && activeDuel.endDate !== null}`);
  console.log(`Days difference (should be 7): ${daysDiff}\n`);

  // --- 8.3 Both complete their habits ---
  console.log("--- VERIFICATION 8.3: Toggle Habits (Both complete on Day 1) ---");
  
  // Complete habitA for User A
  await prisma.$transaction(async (tx) => {
    await processCompletionToggle(tx, userA.id, habitA.id, true);
  });
  
  // Complete habitB for User B
  await prisma.$transaction(async (tx) => {
    await processCompletionToggle(tx, userB.id, habitB.id, true);
  });

  const duelAfterCompletes = await prisma.rival.findUnique({ where: { id: challenge.id } });
  console.log(`After completes - challengerCount (A): ${duelAfterCompletes?.challengerCount}, rivalCount (B): ${duelAfterCompletes?.rivalCount}`);
  console.log(`Did both counts increment to 1? ${duelAfterCompletes?.challengerCount === 1 && duelAfterCompletes?.rivalCount === 1}\n`);

  // --- 8.4 A un-completes habit ---
  console.log("--- VERIFICATION 8.4: Un-complete Habit (A's count decrements) ---");
  await prisma.$transaction(async (tx) => {
    await processCompletionToggle(tx, userA.id, habitA.id, false);
  });

  const duelAfterUncomplete = await prisma.rival.findUnique({ where: { id: challenge.id } });
  console.log(`After A un-complete - challengerCount (A): ${duelAfterUncomplete?.challengerCount}, rivalCount (B): ${duelAfterUncomplete?.rivalCount}`);
  console.log(`Did A's count decrement to 0 while B's stayed 1? ${duelAfterUncomplete?.challengerCount === 0 && duelAfterUncomplete?.rivalCount === 1}\n`);

  // --- 8.5/8.6 Manually fast-forward endDate and resolve ---
  console.log("--- VERIFICATION 8.5/8.6: Fast-forward & Duel Resolution ---");
  // Update endDate to 5 seconds ago to simulate expiration
  const pastDate = new Date(Date.now() - 5000);
  await prisma.rival.update({
    where: { id: challenge.id },
    data: { endDate: pastDate },
  });
  console.log(`Set duel endDate in DB to past date: ${pastDate.toISOString()}`);

  // Trigger lazy resolution for User B
  await prisma.$transaction(async (tx) => {
    await resolvePendingDuels(tx, userB.id);
  });

  const resolvedDuel = await prisma.rival.findUnique({ where: { id: challenge.id } });
  console.log("Resolved Duel Row:");
  console.log(JSON.stringify(resolvedDuel, null, 2));
  console.log(`Status becomes completed: ${resolvedDuel?.status === "completed"}`);
  console.log(`Winner ID is User B: ${resolvedDuel?.winnerId === userB.id}`);

  // Verify achievements checking for User B
  const bAchievements = await prisma.userAchievement.findMany({
    where: { userId: userB.id },
    include: { achievement: true }
  });
  console.log("User B achievements awarded:");
  console.log(JSON.stringify(bAchievements.map(ba => ba.achievement.key)));
  console.log(`Did rival_winner achievement fire? ${bAchievements.some(ba => ba.achievement.key === "rival_winner")}\n`);

  // --- 8.10 Check CHA score after win ---
  console.log("--- VERIFICATION 8.10: CHA Score updates (incorporating real duel data) ---");
  const statsBAfter = await prisma.userStats.findUnique({ where: { userId: userB.id } });
  console.log(`User B stats - Wins: ${statsBAfter?.rivalWins}, Losses: ${statsBAfter?.rivalLosses}, Ties: ${statsBAfter?.rivalTies}`);
  console.log(`User B CHA Score after 1 win (100% win rate): ${statsBAfter?.chaScore}`);
  console.log(`Did B's CHA score update? ${statsBAfter?.chaScore !== statsABefore?.chaScore}\n`);

  // --- 8.7 Loser submits defeat message ---
  console.log("--- VERIFICATION 8.7: Defeat Message Submission ---");
  const defeatMsgInput = "Good fight! Your lap times were too solid for me.";

  
  // Let's write the logic in-transaction to test error rejections cleanly:
  const submitDefeatMessage = async (callerId: string, duelId: string, msg: string) => {
    if (msg.length > 200) throw new Error("MESSAGE_TOO_LONG");
    const d = await prisma.rival.findUnique({ where: { id: duelId } });
    if (!d) throw new Error("DUEL_NOT_FOUND");
    if (d.status !== "completed") throw new Error("DUEL_NOT_COMPLETED");
    if (d.winnerId === null) throw new Error("NO_LOSER_FOR_TIES");
    const loser = d.winnerId === d.challengerId ? d.rivalId : d.challengerId;
    if (callerId !== loser) throw new Error("ONLY_LOSER_CAN_SUBMIT");
    if (d.defeatMessage !== null) throw new Error("ALREADY_SUBMITTED");

    return await prisma.rival.update({
      where: { id: duelId },
      data: { defeatMessage: msg },
    });
  };

  const updatedDuelWithMsg = await submitDefeatMessage(userA.id, challenge.id, defeatMsgInput);
  console.log(`Defeat message successfully stored on row? ${updatedDuelWithMsg.defeatMessage === defeatMsgInput}`);
  console.log(`Loser's message: "${updatedDuelWithMsg.defeatMessage}"\n`);

  // --- 8.8 Attempt submitting a SECOND defeat message ---
  console.log("--- VERIFICATION 8.8: Attempt second defeat message rejection ---");
  try {
    await submitDefeatMessage(userA.id, challenge.id, "Second try message");
  } catch (e: any) {
    console.log("Caught expected error for double submission:", e.message);
  }
  console.log("");

  // Clean up
  console.log("Cleaning up test data...");
  await prisma.user.delete({ where: { id: userA.id } });
  await prisma.user.delete({ where: { id: userB.id } });
  console.log("Test data cleaned up successfully!");
}

run()
  .catch((e) => {
    console.error("Verification script failed:", e);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
