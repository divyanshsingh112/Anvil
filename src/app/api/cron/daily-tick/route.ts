import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAndApplyStreakDecayAndRecharge } from "@/lib/streak-decay";
import { resolvePendingDuels } from "@/lib/services/rival-service";
import { triggerLazyMomentumRecalculation } from "@/lib/services/momentum-service";
import { triggerLazyArchetypeClassification } from "@/lib/services/archetype-service";
import { exportAnonymizedSnapshot } from "@/lib/services/training-export-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Dedicated CRON_SECRET Authentication Header Validation
    const authHeader = request.headers.get("authorization");
    const cronHeader = request.headers.get("x-cron-secret");
    const cronSecret = process.env.CRON_SECRET;

    let isAuthorized = false;
    if (cronSecret) {
      if (cronHeader === cronSecret) isAuthorized = true;
      if (authHeader === `Bearer ${cronSecret}`) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch all users for daily batch processing
    const users = await prisma.user.findMany({
      select: {
        id: true,
        trainingDataConsent: true,
      },
    });

    const now = new Date();
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    const results = {
      timestamp: now.toISOString(),
      dateStr: todayStr,
      totalUsers: users.length,
      processed: 0,
      decayChecks: 0,
      momentumUpdates: 0,
      archetypeUpdates: 0,
      resolvedDuels: 0,
      snapshotsExported: 0,
      errors: [] as { userId: string; error: string }[],
    };

    for (const user of users) {
      try {
        // Step A: Transactional maintenance (Streak Decay & Expired Duels)
        await prisma.$transaction(async (tx) => {
          // 1. Streak decay & shield recharge
          await checkAndApplyStreakDecayAndRecharge(tx, user.id);
          // 2. Expired rival duel resolution
          await resolvePendingDuels(tx, user.id);
        });
        results.decayChecks++;
        results.resolvedDuels++;

        // Step B: Momentum recalculation (Idempotent: checks lastComputedAt === todayStr)
        const momentumRes = await triggerLazyMomentumRecalculation(user.id, now);
        if (momentumRes.recalculated) {
          results.momentumUpdates++;
        }

        // Step C: Archetype classification (Idempotent: checks archetypeComputedAt === todayStr)
        const archetypeRes = await triggerLazyArchetypeClassification(user.id, now);
        if (archetypeRes.recalculated) {
          results.archetypeUpdates++;
        }

        // Step D: Anonymized ML training export (for opted-in users)
        if (user.trainingDataConsent) {
          await exportAnonymizedSnapshot(user.id);
          results.snapshotsExported++;
        }

        results.processed++;
      } catch (userErr: any) {
        console.error(`[Cron Daily-Tick] Error processing user ${user.id}:`, userErr?.message || userErr);
        results.errors.push({
          userId: user.id,
          error: userErr?.message || String(userErr),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Daily tick completed for ${results.processed}/${results.totalUsers} users.`,
      results,
    });
  } catch (error: any) {
    console.error("[Cron Daily-Tick Error]:", error?.message || error);
    return NextResponse.json(
      { error: "Internal server error during cron tick" },
      { status: 500 }
    );
  }
}
