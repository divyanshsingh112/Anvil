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

    const userId = session.user.id;

    // 1. Fetch all achievement definitions
    const allAchievements = await prisma.achievement.findMany({
      orderBy: { xpReward: "asc" }
    });

    // 2. Fetch user's unlocked achievements
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId }
    });

    // Create a map of achievementId -> unlockedAt for fast lookup
    const unlockedMap = new Map<string, Date>(
      userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt])
    );

    // 3. Annotate achievements with unlock status
    const result = allAchievements.map((ach) => {
      const unlockedAt = unlockedMap.get(ach.id) || null;
      return {
        id: ach.id,
        key: ach.key,
        name: ach.name,
        description: ach.description,
        xpReward: ach.xpReward,
        icon: ach.icon,
        unlocked: !!unlockedAt,
        unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET achievements error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
