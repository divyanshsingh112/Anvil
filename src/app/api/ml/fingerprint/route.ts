import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calculateProcrastinationFingerprint } from "@/lib/procrastination-calculator";
import { classifyArchetype } from "@/lib/archetype-classifier";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch Archetype & Volatility signals for composite calculation
    const archetypeResult = await classifyArchetype(userId);
    const archetype = archetypeResult.archetype === "insufficient_data" ? "steady_strategist" : archetypeResult.archetype;
    const streakVolatility = archetypeResult.features?.streakVolatility ?? 0;

    // Run calculator
    const results = await calculateProcrastinationFingerprint(userId, undefined, {
      streakVolatility,
      archetype,
    });
    const { dangerZoneHours, lastMinuteRate, procrastinationScore, avoidancePattern, confidence } = results;

    // Save to MlUserProfile (upsert)
    const dbDangerZone = dangerZoneHours === "insufficient_data" ? [] : dangerZoneHours;
    const dbLastMinute = lastMinuteRate === "insufficient_data" ? null : new Prisma.Decimal(lastMinuteRate);
    const dbProcrastination = procrastinationScore === "insufficient_data" ? null : new Prisma.Decimal(procrastinationScore);
    const dbAvoidance = avoidancePattern as any;

    await prisma.mlUserProfile.upsert({
      where: { userId },
      create: {
        userId,
        dangerZoneHours: dbDangerZone,
        lastMinuteRate: dbLastMinute,
        procrastinationScore: dbProcrastination,
        avoidancePattern: dbAvoidance,
        lastComputedAt: new Date(),
      },
      update: {
        dangerZoneHours: dbDangerZone,
        lastMinuteRate: dbLastMinute,
        procrastinationScore: dbProcrastination,
        avoidancePattern: dbAvoidance,
        lastComputedAt: new Date(),
      },
    });

    return NextResponse.json({
      dangerZoneHours,
      lastMinuteRate,
      procrastinationScore,
      avoidancePattern,
      confidence,
    });
  } catch (error) {
    console.error("GET /api/ml/fingerprint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
