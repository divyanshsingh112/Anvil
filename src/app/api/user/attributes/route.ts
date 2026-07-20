import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateAttributeScores } from "@/lib/attribute-calculator";
import { calculateCompletionRate } from "@/lib/completion-rate";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/attributes
 * Returns the 4 attribute scores (STR, INT, WIS, CHA) for the session user.
 *
 * Unlike the in-transaction recalculation (which uses a default completion rate
 * for CHA), this endpoint computes the accurate overall completion rate for
 * a more precise CHA value on the radar chart.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch UserStats and User in parallel
    const [stats, user] = await Promise.all([
      prisma.userStats.findUnique({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { streak: true, longestStreak: true, createdAt: true },
      }),
    ]);

    if (!stats || !user) {
      // Return zeroed scores for users with no stats yet
      return NextResponse.json({
        strScore: 0,
        intScore: 0,
        wisScore: 0,
        chaScore: 0,
      });
    }

    // Compute accurate overall completion rate for CHA
    // Use last 30 days as the completion rate window
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const thirtyDaysAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);

    const rateResult = await calculateCompletionRate(
      prisma,
      userId,
      thirtyDaysAgo,
      today
    );

    const scores = calculateAttributeScores({
      warriorCompletions: stats.warriorCompletions,
      mageCompletions: stats.mageCompletions,
      rogueCompletions: stats.rogueCompletions,
      totalCompletions: stats.totalCompletions,
      streak: user.streak,
      longestStreak: user.longestStreak,
      overallCompletionRate: rateResult.percentage,
    });

    return NextResponse.json({
      strScore: scores.strScore,
      intScore: scores.intScore,
      wisScore: scores.wisScore,
      chaScore: scores.chaScore,
    });
  } catch (error) {
    console.error("GET user/attributes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
