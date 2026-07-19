import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/habits/year-stats?year=2026
 * Returns 12-month stats for a given year:
 * { month, completions, totalPossible, rate, hasHabits }
 *
 * totalPossible respects:
 * - activeDays (only counts days matching the habit's schedule)
 * - createdAt (only counts days from habit creation onward)
 * - Capped at today if viewing the current year/month
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get("year");

    if (!yearStr) {
      return NextResponse.json(
        { error: "Year query parameter is required" },
        { status: 400 }
      );
    }

    const year = parseInt(yearStr, 10);
    if (isNaN(year)) {
      return NextResponse.json(
        { error: "Invalid year format" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const today = now.getDate();

    // Fetch all active habits for this year
    const habits = await prisma.habit.findMany({
      where: { userId, year, archivedAt: null },
      select: {
        id: true,
        month: true,
        activeDays: true,
        createdAt: true,
      },
    });

    // Fetch all completions for the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const completions = await prisma.completion.findMany({
      where: {
        userId,
        date: { gte: startDate, lt: endDate },
      },
      select: { date: true },
    });

    // Group completions by month
    const completionsByMonth: Record<number, number> = {};
    for (const c of completions) {
      const d = new Date(c.date);
      const m = d.getMonth() + 1;
      completionsByMonth[m] = (completionsByMonth[m] || 0) + 1;
    }

    // Build stats for all 12 months
    const monthStats = [];
    for (let month = 1; month <= 12; month++) {
      const monthHabits = habits.filter((h) => h.month === month);
      const hasHabits = monthHabits.length > 0;

      let totalPossible = 0;

      if (hasHabits) {
        // Days in this month
        const daysInMonth = new Date(year, month, 0).getDate();

        // Cap end day: if this is the current year & month, cap at today
        const endDay =
          year === currentYear && month === currentMonth
            ? today
            : daysInMonth;

        for (const habit of monthHabits) {
          const createdDate = new Date(habit.createdAt);
          // Start counting from the later of: 1st of month, or habit createdAt
          let startDay = 1;
          if (
            createdDate.getFullYear() === year &&
            createdDate.getMonth() + 1 === month
          ) {
            startDay = createdDate.getDate();
          }

          for (let day = startDay; day <= endDay; day++) {
            const date = new Date(year, month - 1, day);
            const dow = date.getDay(); // 0=Sun, 6=Sat

            // If habit has activeDays set, only count matching days
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
      }

      const completionCount = completionsByMonth[month] || 0;
      const rate =
        totalPossible > 0
          ? Math.round((completionCount / totalPossible) * 100)
          : 0;

      monthStats.push({
        month,
        completions: completionCount,
        totalPossible,
        rate,
        hasHabits,
      });
    }

    return NextResponse.json(monthStats);
  } catch (error) {
    console.error("GET habits/year-stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
