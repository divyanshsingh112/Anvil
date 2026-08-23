import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prismaDirect } from "@/lib/prisma";
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

    // Run the toggle operation inside a single atomic database transaction using prismaDirect (direct session connection on port 5432)
    const result = await prismaDirect.$transaction(
      async (tx: Prisma.TransactionClient) => {
        return await processCompletionToggle(tx, userId, habitId, completed, {
          timeBucket,
          timeAccuracy,
          customCompletedAt,
        });
      },
      { timeout: 15000, maxWait: 5000 }
    );

    // Post-toggle Non-Critical Async Side Effects (dispatched AFTER transaction commits)
    // Each side effect is individually guarded so a dynamic import or execution failure never impacts the response.
    Promise.allSettled([
      (async () => {
        try {
          const { triggerLazyMomentumRecalculation } = await import("@/lib/services/momentum-service");
          await triggerLazyMomentumRecalculation(userId, new Date(), true);
        } catch (err) {
          console.error("[Post-Toggle Momentum Recalc Error]:", err);
        }
      })(),
      (async () => {
        try {
          const { triggerLazyArchetypeClassification } = await import("@/lib/services/archetype-service");
          await triggerLazyArchetypeClassification(userId, new Date(), true);
        } catch (err) {
          console.error("[Post-Toggle Archetype Classification Error]:", err);
        }
      })(),
    ]);

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
