import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { checkAndApplyStreakDecayAndRecharge } from "@/lib/streak-decay";
import { FEATURE_CONSISTENCY_SCORE } from "@/config/features";
import { calculateConsistencyScore } from "@/lib/consistency-calculator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user, stats] = await prisma.$transaction(async (tx) => {
      const u = await checkAndApplyStreakDecayAndRecharge(tx, session.user.id);
      let s = await tx.userStats.findUnique({
        where: { userId: session.user.id },
      });
      if (!s && u) {
        s = await tx.userStats.create({
          data: {
            userId: u.id,
            totalCompletions: 0,
            warriorCompletions: 0,
            mageCompletions: 0,
            rogueCompletions: 0,
          },
        });
      }
      return [u, s];
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Asynchronously trigger daily lazy momentum recalculation (non-blocking)
    import("@/lib/services/momentum-service").then(({ triggerLazyMomentumRecalculation }) => {
      triggerLazyMomentumRecalculation(session.user.id).catch(console.error);
    });

    // Asynchronously trigger lazy training data export if consent is given
    if (user.trainingDataConsent) {
      import("@/lib/services/training-export-service").then(({ exportAnonymizedSnapshot }) => {
        exportAnonymizedSnapshot(session.user.id).catch(console.error);
      });
    }

    // Asynchronously trigger lazy archetype classification (Phase 21)
    import("@/lib/services/archetype-service").then(({ triggerLazyArchetypeClassification }) => {
      triggerLazyArchetypeClassification(session.user.id).catch(console.error);
    });

    let consistencyScore: number | undefined = undefined;
    if (FEATURE_CONSISTENCY_SCORE) {
      consistencyScore = await calculateConsistencyScore(prisma, session.user.id);
    }

    return NextResponse.json({
      xp: Number(user.xp),
      level: user.level,
      coins: user.coins,
      streak: user.streak,
      longestStreak: user.longestStreak,
      activeTheme: user.activeTheme,
      streakShieldActive: user.streakShieldActive,
      freeFreezeCharges: user.freeFreezeCharges,
      freezeActiveDate: user.freezeActiveDate,
      warriorCompletions: stats?.warriorCompletions || 0,
      mageCompletions: stats?.mageCompletions || 0,
      rogueCompletions: stats?.rogueCompletions || 0,
      trainingDataConsent: user.trainingDataConsent,
      trainingConsentUpdatedAt: user.trainingConsentUpdatedAt,
      allowChallenges: user.allowChallenges ?? true,
      consistencyScore,
    });
  } catch (error) {
    console.error("GET user stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
