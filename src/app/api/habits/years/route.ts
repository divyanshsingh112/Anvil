import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/habits/years
 * Returns distinct years with habit data + total completions per year.
 * Always includes the current real-world year.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get distinct years that have habits
    const habitYears = await prisma.habit.findMany({
      where: { userId, archivedAt: null },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });

    const yearsSet = new Set(habitYears.map((h) => h.year));

    // Always include the current real-world year
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    // Get total completions per year (lightweight aggregate)
    const yearStats = await Promise.all(
      years.map(async (year) => {
        const startDate = new Date(year, 0, 1); // Jan 1
        const endDate = new Date(year + 1, 0, 1); // Jan 1 next year

        const completionCount = await prisma.completion.count({
          where: {
            userId,
            date: {
              gte: startDate,
              lt: endDate,
            },
          },
        });

        return {
          year,
          totalCompletions: completionCount,
        };
      })
    );

    return NextResponse.json(yearStats);
  } catch (error) {
    console.error("GET habits/years error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
