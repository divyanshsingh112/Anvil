import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = 10;
    const skip = (page - 1) * limit;

    // Fetch completed/declined duels for this user
    const history = await prisma.rival.findMany({
      where: {
        status: { in: ["completed", "declined"] },
        OR: [
          { challengerId: userId },
          { rivalId: userId },
        ],
      },
      include: {
        challenger: { select: { displayName: true } },
        rival: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1, // Fetch limit + 1 to easily determine if hasNextPage exists
    });

    const hasNextPage = history.length > limit;
    const items = hasNextPage ? history.slice(0, limit) : history;

    const data = items.map((d) => ({
      id: d.id,
      habitName: d.habitName,
      startDate: d.startDate,
      endDate: d.endDate,
      challengerId: d.challengerId,
      challengerName: d.challenger.displayName,
      challengerCount: d.challengerCount,
      rivalId: d.rivalId,
      rivalName: d.rival.displayName,
      rivalCount: d.rivalCount,
      status: d.status,
      winnerId: d.winnerId,
      defeatMessage: d.defeatMessage,
      createdAt: d.createdAt,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        hasNextPage,
      },
    });
  } catch (error) {
    console.error("GET /api/rivals/history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
