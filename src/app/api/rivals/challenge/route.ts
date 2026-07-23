import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChallenge } from "@/lib/services/rival-service";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { rivalUsername, rivalUserId, habitId, habitName } = body;

    const rivalIdentifier = rivalUsername || rivalUserId;
    if (!rivalIdentifier || !habitId || !habitName) {
      return NextResponse.json(
        { error: "rivalUsername or rivalUserId, habitId, and habitName are required" },
        { status: 400 }
      );
    }

    // Run challenge creation in a transaction
    const challenge = await prisma.$transaction(async (tx) => {
      return await createChallenge(tx, userId, habitId, habitName, rivalIdentifier);
    });

    return NextResponse.json(challenge, { status: 201 });
  } catch (error) {
    const errObj = error as Error;
    if (
      errObj.message === "HABIT_NOT_FOUND" ||
      errObj.message === "RIVAL_NOT_FOUND" ||
      errObj.message === "CANNOT_CHALLENGE_SELF" ||
      errObj.message === "DUEL_ALREADY_EXISTS"
    ) {
      return NextResponse.json({ error: errObj.message }, { status: 400 });
    }

    console.error("POST /api/rivals/challenge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
