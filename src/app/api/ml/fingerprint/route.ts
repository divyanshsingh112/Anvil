import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calculateProcrastinationFingerprint } from "@/lib/procrastination-calculator";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Run calculator
    const results = await calculateProcrastinationFingerprint(userId);
    const { dangerZoneHours, lastMinuteRate, avoidancePattern, confidence } = results;

    // Save to MlUserProfile (upsert)
    const dbDangerZone = dangerZoneHours === "insufficient_data" ? [] : dangerZoneHours;
    const dbLastMinute = lastMinuteRate === "insufficient_data" ? null : new Prisma.Decimal(lastMinuteRate);
    const dbProcrastination = lastMinuteRate === "insufficient_data" ? null : new Prisma.Decimal(lastMinuteRate);
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
