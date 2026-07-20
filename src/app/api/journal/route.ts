import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/journal
 * Returns noted completions for the authenticated user, paginated (20 per page),
 * ordered by completedAt DESC.
 *
 * Query Parameters:
 *   - page: number (default 1)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageStr = searchParams.get("page") || "1";
    let page = parseInt(pageStr, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    const limit = 20;
    const skip = (page - 1) * limit;

    const userId = session.user.id;

    // Fetch completions with notes (not null and not empty string)
    const completions = await prisma.completion.findMany({
      where: {
        userId,
        note: {
          not: null,
          notIn: [""],
        },
      },
      include: {
        habit: {
          select: {
            name: true,
            class: true,
          },
        },
      },
      orderBy: {
        completedAt: "desc",
      },
      skip,
      take: limit + 1, // Fetch limit + 1 to easily determine if hasNextPage exists
    });

    const hasNextPage = completions.length > limit;
    const items = hasNextPage ? completions.slice(0, limit) : completions;

    // Map to a clean, flat response structure
    const data = items.map((c) => ({
      id: c.id,
      date: c.date,
      completedAt: c.completedAt,
      note: c.note,
      habitName: c.habit.name,
      habitClass: c.habit.class,
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
    console.error("GET journal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
