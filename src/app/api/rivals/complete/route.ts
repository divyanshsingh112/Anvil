import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { rivalId, defeatMessage } = body; // rivalId is the duel row ID

    if (!rivalId || !defeatMessage || typeof defeatMessage !== "string" || defeatMessage.trim().length === 0) {
      return NextResponse.json(
        { error: "rivalId (duel ID) and a non-empty defeatMessage are required" },
        { status: 400 }
      );
    }

    if (defeatMessage.length > 200) {
      return NextResponse.json(
        { error: "Defeat message cannot exceed 200 characters" },
        { status: 400 }
      );
    }

    const duel = await prisma.rival.findUnique({
      where: { id: rivalId },
    });

    if (!duel) {
      return NextResponse.json({ error: "Duel not found" }, { status: 404 });
    }

    if (duel.status !== "completed") {
      return NextResponse.json({ error: "Duel is not completed yet" }, { status: 400 });
    }

    if (duel.winnerId === null) {
      return NextResponse.json({ error: "This duel was a tie; there is no loser to submit a defeat message" }, { status: 400 });
    }

    // Determine the loser
    const loserId = duel.winnerId === duel.challengerId ? duel.rivalId : duel.challengerId;

    if (userId !== loserId) {
      return NextResponse.json({ error: "Only the losing user can submit a defeat message" }, { status: 403 });
    }

    if (duel.defeatMessage !== null) {
      return NextResponse.json({ error: "Defeat message has already been submitted" }, { status: 400 });
    }

    // Save the defeat message
    const updated = await prisma.rival.update({
      where: { id: rivalId },
      data: { defeatMessage: defeatMessage.trim() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/rivals/complete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
