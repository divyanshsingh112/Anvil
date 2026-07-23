import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { respondToChallenge } from "@/lib/services/rival-service";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { rivalId, action, habitId } = body; // rivalId is the challenge record ID

    if (!rivalId || !action || (action !== "accept" && action !== "decline")) {
      return NextResponse.json(
        { error: "rivalId (challenge ID) and action ('accept' | 'decline') are required" },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      return await respondToChallenge(tx, userId, rivalId, action, habitId);
    });

    return NextResponse.json(updated);
  } catch (error) {
    const errObj = error as Error;
    if (errObj.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (
      errObj.message === "CHALLENGE_NOT_FOUND" ||
      errObj.message === "CHALLENGE_NOT_PENDING" ||
      errObj.message === "HABIT_REQUIRED" ||
      errObj.message === "HABIT_NOT_FOUND"
    ) {
      return NextResponse.json({ error: errObj.message }, { status: 400 });
    }

    console.error("POST /api/rivals/respond error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
