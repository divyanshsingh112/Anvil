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

    const body = await request.json();
    const { habitId, completed, timeBucket, timeAccuracy, customCompletedAt } = body;

    if (!habitId || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "habitId (string) and completed (boolean) are required fields" },
        { status: 400 }
      );
    }

    // Look up habit and verify ownership
    const habit = await prisma.habit.findFirst({
      where: {
        id: habitId,
        userId: session.user.id,
      },
    });

    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    const now = new Date();
    // Anti-cheat: Always calculate date on server only
    const year = now.getFullYear();
    const month = now.getMonth();
    const dateVal = now.getDate();
    const today = new Date(Date.UTC(year, month, dateVal));

    if (completed === false) {
      // Find and delete the completion if it exists (un-toggling)
      const existing = await prisma.completion.findFirst({
        where: {
          habitId,
          userId: session.user.id,
          date: today,
        },
      });

      if (existing) {
        await prisma.completion.delete({
          where: { id: existing.id },
        });
      }

      return NextResponse.json(null);
    }

    // Determine time parameters
    let derivedTimeBucket = timeBucket;
    let derivedTimeAccuracy = timeAccuracy || "skip";
    let completedAtDate = now;

    if (derivedTimeAccuracy === "confirmed") {
      if (customCompletedAt) {
        const parsed = new Date(customCompletedAt);
        if (!isNaN(parsed.getTime())) {
          completedAtDate = parsed;
        }
      }
      // If timeBucket not provided but accuracy is confirmed, derive it from completedAtDate
      if (!derivedTimeBucket) {
        const hour = completedAtDate.getHours();
        if (hour >= 5 && hour <= 11) {
          derivedTimeBucket = "morning";
        } else if (hour >= 12 && hour <= 16) {
          derivedTimeBucket = "afternoon";
        } else if (hour >= 17 && hour <= 21) {
          derivedTimeBucket = "evening";
        } else {
          derivedTimeBucket = "night";
        }
      }
    } else if (derivedTimeAccuracy === "estimated") {
      completedAtDate = now;
      if (!derivedTimeBucket) {
        derivedTimeBucket = "morning"; // Fallback if estimate is somehow missing
      }
    } else {
      // "skip" or fallback path
      derivedTimeAccuracy = "skip";
      completedAtDate = now;
      
      const hour = now.getHours();
      if (hour >= 5 && hour <= 11) {
        derivedTimeBucket = "morning";
      } else if (hour >= 12 && hour <= 16) {
        derivedTimeBucket = "afternoon";
      } else if (hour >= 17 && hour <= 21) {
        derivedTimeBucket = "evening";
      } else {
        derivedTimeBucket = "night";
      }
    }

    // Upsert completion record
    const existing = await prisma.completion.findFirst({
      where: {
        habitId,
        userId: session.user.id,
        date: today,
      },
    });

    let completion;
    if (existing) {
      completion = await prisma.completion.update({
        where: { id: existing.id },
        data: {
          loggedAt: now,
          completedAt: completedAtDate,
          timeBucket: derivedTimeBucket,
          timeAccuracy: derivedTimeAccuracy,
        },
      });
    } else {
      completion = await prisma.completion.create({
        data: {
          habitId,
          userId: session.user.id,
          date: today,
          loggedAt: now,
          completedAt: completedAtDate,
          timeBucket: derivedTimeBucket,
          timeAccuracy: derivedTimeAccuracy,
        },
      });
    }

    return NextResponse.json(completion);
  } catch (error) {
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
