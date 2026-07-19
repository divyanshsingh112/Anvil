import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/completions/heatmap?year=2026&month=7
 * Returns completions grouped by date for the given month.
 * Response: { date: "YYYY-MM-DD", count: number }[]
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

    // Date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // 1st of next month (exclusive)

    const completions = await prisma.completion.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: { date: true },
    });

    // Group by date string and count
    const dateCounts: Record<string, number> = {};
    for (const c of completions) {
      const d = new Date(c.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    }

    const result = Object.entries(dateCounts).map(([date, count]) => ({
      date,
      count,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET completions/heatmap error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
