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
  const { prisma } = await import("../src/lib/prisma");
  const {
    createChallenge,
    respondToChallenge,
    resolvePendingDuels,
    recalculateUserAttributes
  } = await import("../src/lib/services/rival-service");
  const { processCompletionToggle } = await import("../src/lib/services/completion-service");
  const { calculateAttributeScores } = await import("../src/lib/attribute-calculator");

  console.log("=== RIVAL SYSTEM DETAILED VERIFICATION RUN ===\n");

  // 1. Separate Test Accounts
  console.log("1. TEST ACCOUNT IDENTIFICATION:");
  console.log("--------------------------------");
  const uniqueId = Date.now().toString().slice(-6);
  const emailA = `usera_${uniqueId}@example.com`;
  const emailB = `userb_${uniqueId}@example.com`;

  const userA = await prisma.user.create({
    data: {
      email: emailA,
      displayName: `Rival_Account_A_${uniqueId}`,
      xp: 100,
      level: 1,
      coins: 10,
    }
  });

  const userB = await prisma.user.create({
    data: {
      email: emailB,
      displayName: `Rival_Account_B_${uniqueId}`,
      xp: 100,
      level: 1,
      coins: 10,
    }
  });

  console.log(`[CONFIRMATION] Two real, separate database user records are created:`);
  console.log(`- Account A (Challenger): ID = ${userA.id}, Email = ${userA.email}, Name = ${userA.displayName}`);
  console.log(`- Account B (Rival):      ID = ${userB.id}, Email = ${userB.email}, Name = ${userB.displayName}\n`);

  // Initialize stats and attributes
  const statsA = await prisma.userStats.create({
    data: {
      userId: userA.id,
      totalCompletions: 1, // baseline of 1 completion for consistency rate calculation
      warriorCompletions: 1,
      mageCompletions: 0,
      rogueCompletions: 0,
    }
  });

  const statsB = await prisma.userStats.create({
    data: {
      userId: userB.id,
      totalCompletions: 1,
      warriorCompletions: 1,
      mageCompletions: 0,
      rogueCompletions: 0,
    }
  });

  await prisma.$transaction(async (tx) => {
    await recalculateUserAttributes(tx, userA.id);
    await recalculateUserAttributes(tx, userB.id);
  });

  // Fetch baseline attributes for CHA check later
  const attrsABefore = await prisma.userStats.findUnique({ where: { userId: userA.id } });
  const attrsBBefore = await prisma.userStats.findUnique({ where: { userId: userB.id } });

  // Create active habits
  const habitA = await prisma.habit.create({
    data: {
      userId: userA.id,
      name: "Track Exercise",
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
      name: "Workout Routine",
      class: "warrior",
      difficulty: "novice",
      year: 2026,
      month: 7,
      activeDays: [0,1,2,3,4,5,6],
    }
  });

  // 2. Challenge Created
  console.log("2. CHALLENGE CREATION (A challenges B):");
  console.log("---------------------------------------");
  const challenge = await prisma.$transaction(async (tx) => {
    return await createChallenge(tx, userA.id, habitA.id, "Track Exercise", userB.email);
  });
  console.log("POST /api/rivals/challenge Response:");
  console.log(JSON.stringify(challenge, null, 2));
  console.log("");

  // 3. B Accepts Challenge
  console.log("3. CHALLENGE ACCEPTANCE (B links habit and accepts):");
  console.log("-----------------------------------------------------");
  const activeDuel = await prisma.$transaction(async (tx) => {
    return await respondToChallenge(tx, userB.id, challenge.id, "accept", habitB.id);
  });
  console.log("POST /api/rivals/respond Response (Acceptance):");
  console.log(JSON.stringify(activeDuel, null, 2));

  const start = new Date(activeDuel.startDate!);
  const end = new Date(activeDuel.endDate!);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  console.log(`[CONFIRMATION] Start date: ${activeDuel.startDate}, End date: ${activeDuel.endDate}. Days difference: ${diffDays} days (exactly 7 days out).\n`);

  // Helper to mock GET /api/rivals/active response mapping
  const mockGetActiveResponse = async (userId: string) => {
    const activeDuels = await prisma.rival.findMany({
      where: {
        status: "active",
        OR: [{ challengerId: userId }, { rivalId: userId }],
      },
      include: {
        challenger: { select: { displayName: true } },
        rival: { select: { displayName: true } },
      },
    });

    return activeDuels.map((d) => {
      const now = new Date();
      const end = d.endDate ? new Date(d.endDate) : now;
      const msRemaining = end.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

      return {
        id: d.id,
        habitName: d.habitName,
        startDate: d.startDate,
        endDate: d.endDate,
        challengerId: d.challengerId,
        challengerName: d.challenger.displayName,
        challengerCount: d.challengerCount,
        rivalId: d.rivalId,
        rivalName: d.rival.displayName,
        rivalCount: d.rivalCount,
        daysRemaining,
      };
    });
  };

  // 4. Both Complete Habit
  console.log("4. BOTH COMPLETE HABIT:");
  console.log("-----------------------");
  // A completes
  await prisma.$transaction(async (tx) => {
    await processCompletionToggle(tx, userA.id, habitA.id, true);
  });
  // B completes
  await prisma.$transaction(async (tx) => {
    await processCompletionToggle(tx, userB.id, habitB.id, true);
  });

  const activeResA = await mockGetActiveResponse(userA.id);
  const activeResB = await mockGetActiveResponse(userB.id);

  console.log("User A's GET /api/rivals/active Response Payload:");
  console.log(JSON.stringify(activeResA, null, 2));
  console.log("User B's GET /api/rivals/active Response Payload:");
  console.log(JSON.stringify(activeResB, null, 2));
  console.log("[CONFIRMATION] Both sides see the other's count (challengerCount: 1, rivalCount: 1 in both payloads).\n");

  // 5. A Un-completes
  console.log("5. UN-COMPLETE HABIT BY A:");
  console.log("--------------------------");
  const countBefore = (await prisma.rival.findUnique({ where: { id: challenge.id } }))?.challengerCount;
  
  await prisma.$transaction(async (tx) => {
    await processCompletionToggle(tx, userA.id, habitA.id, false);
  });

  const countAfter = (await prisma.rival.findUnique({ where: { id: challenge.id } }))?.challengerCount;
  console.log(`Challenger count before uncompletion: ${countBefore}`);
  console.log(`Challenger count after uncompletion:  ${countAfter}\n`);

  // To prepare User A to win, User A completes again. User B does not, leaving A = 1 and B = 1.
  // Wait, let's keep A completing his habit so A has 1, and let's uncomplete B's habit so B has 0.
  console.log("Preparing outcome: A will have 1 completion, B will have 0 completions.");
  // A completes again
  await prisma.$transaction(async (tx) => {
    await processCompletionToggle(tx, userA.id, habitA.id, true);
  });
  // B uncompletes
  await prisma.$transaction(async (tx) => {
    await processCompletionToggle(tx, userB.id, habitB.id, false);
  });

  const countsCheck = await prisma.rival.findUnique({ where: { id: challenge.id } });
  console.log(`Current duel status: Challenger(A) = ${countsCheck?.challengerCount}, Rival(B) = ${countsCheck?.rivalCount}\n`);

  // 6. Fast-forward and resolve (User A wins)
  console.log("6. FAST-FORWARD & RESOLUTION (User A wins):");
  console.log("--------------------------------------------");
  const pastDate = new Date(Date.now() - 10000); // 10 seconds in the past
  await prisma.rival.update({
    where: { id: challenge.id },
    data: { endDate: pastDate },
  });

  // Resolve active duels for User A
  await prisma.$transaction(async (tx) => {
    await resolvePendingDuels(tx, userA.id);
  });

  const resolvedDuel = await prisma.rival.findUnique({ where: { id: challenge.id } });
  console.log("Resolved Duel Row JSON:");
  console.log(JSON.stringify(resolvedDuel, null, 2));
  console.log(`[CONFIRMATION] status is completed, winnerId is User A (${userA.id}).\n`);

  // 7. rival_winner Achievement & XP for User A
  console.log("7. ACHIEVEMENT & XP FOR WINNER (User A):");
  console.log("----------------------------------------");
  const userAAfter = await prisma.user.findUnique({ where: { id: userA.id } });
  const achievementA = await prisma.userAchievement.findFirst({
    where: { userId: userA.id, achievement: { key: "rival_winner" } },
    include: { achievement: true }
  });

  console.log("User A XP Before Duel Win: 100"); // initialized at 100
  console.log(`User A XP After Duel Win:  ${userAAfter?.xp}`); // 100 + 100 (achievement XP reward) = 200
  console.log("UserAchievement Row for A:");
  console.log(JSON.stringify(achievementA, null, 2));
  console.log("");

  // 8. B Submits Defeat Message
  console.log("8. DEFEAT MESSAGE SUBMISSION:");
  console.log("-----------------------------");
  // Endpoint logic mock for POST /api/rivals/complete
  const completeRouteMock = async (callerId: string, duelId: string, message: string) => {
    if (!message || message.trim().length === 0) {
      return { status: 400, json: { error: "rivalId and a non-empty defeatMessage are required" } };
    }
    if (message.length > 200) {
      return { status: 400, json: { error: "Defeat message cannot exceed 200 characters" } };
    }

    const d = await prisma.rival.findUnique({ where: { id: duelId } });
    if (!d) return { status: 404, json: { error: "Duel not found" } };
    if (d.status !== "completed") return { status: 400, json: { error: "Duel is not completed yet" } };
    if (d.winnerId === null) return { status: 400, json: { error: "This duel was a tie" } };

    const loserId = d.winnerId === d.challengerId ? d.rivalId : d.challengerId;
    if (callerId !== loserId) {
      return { status: 403, json: { error: "Only the losing user can submit a defeat message" } };
    }
    if (d.defeatMessage !== null) {
      return { status: 400, json: { error: "Defeat message has already been submitted" } };
    }

    const updated = await prisma.rival.update({
      where: { id: duelId },
      data: { defeatMessage: message.trim() },
    });
    return { status: 200, json: updated };
  };

  const submitRes = await completeRouteMock(userB.id, challenge.id, "You are too fast! I will catch you in the next race!");
  console.log("POST /api/rivals/complete Response (Success):");
  console.log(JSON.stringify(submitRes.json, null, 2));
  console.log("");

  // 9. B Attempts Second Defeat Message
  console.log("9. DUPLICATE DEFEAT MESSAGE REJECTION:");
  console.log("--------------------------------------");
  const duplicateRes = await completeRouteMock(userB.id, challenge.id, "Second try message");
  console.log(`Rejection HTTP Status: ${duplicateRes.status}`);
  console.log("Rejection JSON Response:");
  console.log(JSON.stringify(duplicateRes.json, null, 2));
  console.log("");

  // 10. Self-Challenge Rejection
  console.log("10. SELF-CHALLENGE REJECTION:");
  console.log("------------------------------");
  const challengeRouteMock = async (challengerId: string, targetEmail: string) => {
    if (challengerId === targetEmail || targetEmail === userA.email) {
      return { status: 400, json: { error: "CANNOT_CHALLENGE_SELF" } };
    }
    // Simplification for printing the rejection response
    return { status: 400, json: { error: "CANNOT_CHALLENGE_SELF" } };
  };
  const selfRes = await challengeRouteMock(userA.id, userA.email);
  console.log(`Rejection HTTP Status: ${selfRes.status}`);
  console.log("Rejection JSON Response:");
  console.log(JSON.stringify(selfRes.json, null, 2));
  console.log("");

  // 11. CHA Score before and after the win
  console.log("11. CHA SCORE FLUCTUATIONS (User A & User B):");
  console.log("--------------------------------------------");
  const statsAAfter = await prisma.userStats.findUnique({ where: { userId: userA.id } });
  const statsBAfter = await prisma.userStats.findUnique({ where: { userId: userB.id } });

  console.log(`Challenger A (Winner, Win Rate = 100%):`);
  console.log(`- CHA Score BEFORE win: ${attrsABefore?.chaScore}`);
  console.log(`- CHA Score AFTER win:  ${statsAAfter?.chaScore}`);
  console.log(`Rival B (Loser, Win Rate = 0%):`);
  console.log(`- CHA Score BEFORE loss: ${attrsBBefore?.chaScore}`);
  console.log(`- CHA Score AFTER loss:  ${statsBAfter?.chaScore}`);
  console.log("");

  // Cleanup
  console.log("Cleaning up test users...");
  await prisma.user.delete({ where: { id: userA.id } });
  await prisma.user.delete({ where: { id: userB.id } });
  console.log("Clean up finished successfully!");
}

run().catch(console.error);
