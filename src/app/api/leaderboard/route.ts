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

    const currentUserId = session.user.id;

    // Fetch all users sorted by level (desc) and xp (desc) to compute rank
    const allUsers = await prisma.user.findMany({
      orderBy: [
        { level: "desc" },
        { xp: "desc" }
      ],
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        level: true,
        xp: true
      }
    });

    // Compute ranks and find current user
    const formattedUsers = allUsers.map(
      (
        user: {
          id: string;
          displayName: string;
          avatarUrl: string | null;
          level: number;
          xp: any;
        },
        index: number
      ) => ({
        id: user.id,
        displayName: user.displayName || "Anonymous Hero",
        avatarUrl: user.avatarUrl,
        level: user.level,
        xp: Number(user.xp),
        rank: index + 1
      })
    );

    const top50 = formattedUsers.slice(0, 50);
    const currentUserRecord = formattedUsers.find((u) => u.id === currentUserId) || null;

    return NextResponse.json({
      leaderboard: top50,
      currentUser: currentUserRecord
    });
  } catch (error) {
    console.error("GET leaderboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
