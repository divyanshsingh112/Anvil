import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        xp: true,
        level: true,
        coins: true,
        streak: true,
        longestStreak: true,
        activeTheme: true,
      },
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
    });
  } catch (error) {
    console.error("GET user stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
