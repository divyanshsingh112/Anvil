import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { checkAndApplyStreakDecayAndRecharge } from "@/lib/streak-decay";

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
    });
  } catch (error) {
    console.error("GET user stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
