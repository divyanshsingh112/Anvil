import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { XP_PER_COMPLETION } from "@/lib/gamification-constants";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all chains and all habits for this user
    const [chains, habits] = await Promise.all([
      prisma.questChain.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.habit.findMany({
        where: { userId },
        include: { completions: true },
      }),
    ]);

    // Create a map of habitId -> full habit object
    const habitsMap = new Map(
      habits.map((h: { id: string }) => [h.id, h])
    );

    // Resolve habit IDs to full habit objects
    const resolvedChains = chains.map(
      (chain: {
        id: string;
        userId: string;
        name: string;
        habitIds: string[];
        bonusXp: number;
        createdAt: Date;
        lastCompletedDay: Date | null;
      }) => ({
        ...chain,
        habits: chain.habitIds
          .map((id: string) => habitsMap.get(id))
          .filter(Boolean),
      })
    );

    return NextResponse.json(resolvedChains);
  } catch (error) {
    console.error("GET chains error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { name, habitIds } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Chain name is required and cannot be empty" },
        { status: 400 }
      );
    }
    if (name.length > 50) {
      return NextResponse.json(
        { error: "Chain name cannot exceed 50 characters" },
        { status: 400 }
      );
    }

    // Validate habitIds
    if (!habitIds || !Array.isArray(habitIds) || habitIds.length < 2) {
      return NextResponse.json(
        { error: "A chain must contain at least 2 habits" },
        { status: 400 }
      );
    }

    // Fetch all habits in the list to validate ownership and active state
    const habits = await prisma.habit.findMany({
      where: {
        id: { in: habitIds },
      },
    });

    // Check ownership of all queried habits
    const userHabits = habits.filter(
      (h: { userId: string; archivedAt: Date | null; difficulty: string }) =>
        h.userId === userId
    );
    if (userHabits.length !== habitIds.length) {
      return NextResponse.json(
        { error: "One or more habits not found or access denied" },
        { status: 404 }
      );
    }

    // Check if any habit in the chain is archived
    if (userHabits.some((h: { archivedAt: Date | null }) => h.archivedAt !== null)) {
      return NextResponse.json(
        { error: "Cannot create a chain containing archived habits" },
        { status: 400 }
      );
    }

    // Calculate bonus XP (sum of each habit's base XP value)
    let bonusXp = 0;
    for (const habit of userHabits) {
      const difficulty = habit.difficulty as keyof typeof XP_PER_COMPLETION;
      bonusXp += XP_PER_COMPLETION[difficulty] || 10;
    }

    // Create the quest chain
    const chain = await prisma.questChain.create({
      data: {
        userId,
        name: name.trim(),
        habitIds,
        bonusXp,
      },
    });

    return NextResponse.json(chain, { status: 201 });
  } catch (error) {
    console.error("POST chains error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
