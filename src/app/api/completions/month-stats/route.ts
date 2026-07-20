import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateCompletionRate } from "@/lib/completion-rate";

export const dynamic = "force-dynamic";

/**
 * GET /api/completions/month-stats?year=2026&month=7
 * Returns success rate, total completions, and total possible
 * for the given month.
 *
 * Delegates to the shared calculateCompletionRate utility which
 * respects activeDays, createdAt, and archivedAt for fair denominator.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get("year");
    const monthStr = searchParams.get("month");

    if (!yearStr || !monthStr) {
      return NextResponse.json(
        { error: "Year and month query parameters are required" },
        { status: 400 }
      );
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid year or month format" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Month boundaries (inclusive start, inclusive end)
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = new Date(Date.UTC(year, month - 1, daysInMonth));

    const result = await calculateCompletionRate(
      prisma,
      userId,
      startDate,
      endDate
    );

    // Count habits for this specific month (for backward-compat response shape)
    const habitCount = await prisma.habit.count({
      where: { userId, year, month, archivedAt: null },
    });

    return NextResponse.json({
      completions: result.completions,
      totalPossible: result.totalPossible,
      successRate: result.percentage,
      habitCount,
    });
  } catch (error) {
    console.error("GET completions/month-stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
