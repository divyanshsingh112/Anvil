import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateHabitDifficulty } from "@/lib/adaptive-difficulty-evaluator";

import { FEATURE_ENERGY_CHECKIN } from "@/config/features";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const habitId = params.id;
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId: session.user.id },
    });

    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    let energyLevel: "low" | "medium" | "high" | null = null;
    if (FEATURE_ENERGY_CHECKIN) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const checkin = await prisma.energyCheckin.findUnique({
        where: {
          userId_date: {
            userId: session.user.id,
            date: today,
          },
        },
      });
      if (checkin?.level === "low" || checkin?.level === "medium" || checkin?.level === "high") {
        energyLevel = checkin.level as "low" | "medium" | "high";
      }
    }

    const evaluation = await evaluateHabitDifficulty(habitId, undefined, { energyLevel });
    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("GET difficulty suggestion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const habitId = params.id;
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId: session.user.id },
    });

    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action } = body; // "accept" | "dismiss"

    if (action !== "accept" && action !== "dismiss") {
      return NextResponse.json(
        { error: "Action must be 'accept' or 'dismiss'" },
        { status: 400 }
      );
    }

    const evaluation = await evaluateHabitDifficulty(habitId);

    const now = new Date();
    let updatedDifficulty = habit.difficulty;

    if (action === "accept" && evaluation.targetDifficulty) {
      updatedDifficulty = evaluation.targetDifficulty;
    }

    // Update habit: difficulty (if accepted) and cooldown tracking fields
    const updatedHabit = await prisma.habit.update({
      where: { id: habitId },
      data: {
        difficulty: updatedDifficulty,
        lastDifficultySuggestionAt: now,
        lastDifficultySuggestionAction: action,
      },
    });

    return NextResponse.json({
      success: true,
      action,
      updatedHabit,
      evaluation,
    });
  } catch (error) {
    console.error("POST difficulty suggestion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
