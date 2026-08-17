import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateConsistencyTrend } from "@/lib/consistency-trend-calculator";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/consistency-trend
 * Returns an array of { month, year, label, percentage, hadHabits }
 * for the last 6 calendar months (current + previous 5).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trend = await calculateConsistencyTrend(session.user.id);
    return NextResponse.json(trend, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    console.error("GET user/consistency-trend error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
