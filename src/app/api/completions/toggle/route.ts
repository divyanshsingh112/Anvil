import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processCompletionToggle } from "@/lib/services/completion-service";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { habitId, completed, timeBucket, timeAccuracy, customCompletedAt } = body;

    if (!habitId || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "habitId (string) and completed (boolean) are required fields" },
        { status: 400 }
      );
    }

    // Run the toggle operation inside a single atomic database transaction (Phase 11.5 logic)
    const result = await prisma.$transaction(async (tx) => {
      return await processCompletionToggle(tx, userId, habitId, completed, {
        timeBucket,
        timeAccuracy,
        customCompletedAt,
      });
    });

    // Post-toggle Non-Critical Async Side Effects (dispatched AFTER transaction commits)
    // Non-blocking fire-and-forget: failures log only and never affect toggle status or rollback transaction
    Promise.allSettled([
      import("@/lib/services/momentum-service").then(({ triggerLazyMomentumRecalculation }) =>
        triggerLazyMomentumRecalculation(userId, new Date(), true)
      ),
      import("@/lib/services/archetype-service").then(({ triggerLazyArchetypeClassification }) =>
        triggerLazyArchetypeClassification(userId, new Date(), true)
      ),
    ]).catch((err) => {
      console.error("[Post-Toggle Async Side Effect Error]:", err);
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorObj = error as Error;
    if (errorObj.message === "HABIT_NOT_FOUND") {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }
    if (errorObj.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("POST completions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ message: "Completions toggle API stub" });
}
