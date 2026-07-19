import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/completions/month-stats?year=2026&month=7
 * Returns success rate, total completions, and total possible
 * for the given month.
 *
 * Respects activeDays and createdAt for fair denominator calculation.
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
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const today = now.getDate();

    // Fetch active habits for this month
    const habits = await prisma.habit.findMany({
      where: { userId, year, month, archivedAt: null },
      select: {
        id: true,
        activeDays: true,
        createdAt: true,
      },
    });

    // Count completions for this month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const completionCount = await prisma.completion.count({
      where: {
        userId,
        date: { gte: startDate, lt: endDate },
      },
    });

    // Calculate total possible completions (denominator)
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDay =
      year === currentYear && month === currentMonth ? today : daysInMonth;

    let totalPossible = 0;

    for (const habit of habits) {
      const createdDate = new Date(habit.createdAt);
      let startDay = 1;
      if (
        createdDate.getFullYear() === year &&
        createdDate.getMonth() + 1 === month
      ) {
        startDay = createdDate.getDate();
      }

      for (let day = startDay; day <= endDay; day++) {
        const date = new Date(year, month - 1, day);
        const dow = date.getDay();

        if (
          habit.activeDays &&
          habit.activeDays.length > 0 &&
          !habit.activeDays.includes(dow)
        ) {
          continue;
        }

        totalPossible++;
      }
    }

    const successRate =
      totalPossible > 0
        ? Math.round((completionCount / totalPossible) * 100)
        : 0;

    return NextResponse.json({
      completions: completionCount,
      totalPossible,
      successRate,
      habitCount: habits.length,
    });
  } catch (error) {
    console.error("GET completions/month-stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
