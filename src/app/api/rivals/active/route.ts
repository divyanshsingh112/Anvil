import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePendingDuels } from "@/lib/services/rival-service";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Lazily resolve any expired active duels for this user first
    await prisma.$transaction(async (tx) => {
      await resolvePendingDuels(tx, userId);
    });

    // 2. Fetch active duels
    const activeDuels = await prisma.rival.findMany({
      where: {
        status: "active",
        OR: [
          { challengerId: userId },
          { rivalId: userId },
        ],
      },
      include: {
        challenger: { select: { displayName: true } },
        rival: { select: { displayName: true } },
      },
      orderBy: { endDate: "asc" },
    });

    // 3. Fetch pending challenges awaiting this user
    const pendingIncoming = await prisma.rival.findMany({
      where: {
        status: "pending",
        rivalId: userId,
      },
      include: {
        challenger: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 4. Fetch pending challenges sent by this user
    const pendingOutgoing = await prisma.rival.findMany({
      where: {
        status: "pending",
        challengerId: userId,
      },
      include: {
        rival: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 5. Fetch UserStats for win/loss summary
    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    return NextResponse.json({
      active: activeDuels.map(
        (d: {
          id: string;
          habitName: string;
          startDate: Date | null;
          endDate: Date | null;
          challengerId: string;
          challenger: { displayName: string };
          challengerCount: number;
          rivalId: string;
          rival: { displayName: string };
          rivalCount: number;
        }) => {
          const now = new Date();
          const end = d.endDate ? new Date(d.endDate) : now;
          const msRemaining = end.getTime() - now.getTime();
          const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

          return {
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
            daysRemaining,
          };
        }
      ),
      pendingIncoming: pendingIncoming.map(
        (p: {
          id: string;
          habitName: string;
          challengerId: string;
          challenger: { displayName: string };
          createdAt: Date;
        }) => ({
          id: p.id,
          habitName: p.habitName,
          challengerId: p.challengerId,
          challengerName: p.challenger.displayName,
          createdAt: p.createdAt,
        })
      ),
      pendingOutgoing: pendingOutgoing.map(
        (p: {
          id: string;
          habitName: string;
          rivalId: string;
          rival: { displayName: string };
          createdAt: Date;
        }) => ({
          id: p.id,
          habitName: p.habitName,
          rivalId: p.rivalId,
          rivalName: p.rival.displayName,
          createdAt: p.createdAt,
        })
      ),
      stats: {
        wins: stats?.rivalWins || 0,
        losses: stats?.rivalLosses || 0,
        ties: stats?.rivalTies || 0,
      },
    });
  } catch (error) {
    console.error("GET /api/rivals/active error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
