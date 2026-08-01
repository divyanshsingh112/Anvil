import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateHabitDifficulty } from "@/lib/adaptive-difficulty-evaluator";
import { calculateProcrastinationFingerprint } from "@/lib/procrastination-calculator";
import { classifyArchetype } from "@/lib/archetype-classifier";
import { callAutopsyModel } from "@/lib/gemini-client";

export const dynamic = "force-dynamic";

const DAILY_AUTOPSY_LIMIT = 5;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const habitId = params.id;

    // 1. Verify habit ownership
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });

    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    const now = new Date();
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    const autopsyDate = new Date(todayStr);

    // 2. Cache Check: Returning existing autopsy if generated today
    const cached = await prisma.habitAutopsy.findUnique({
      where: {
        habitId_autopsyDate: {
          habitId,
          autopsyDate,
        },
      },
    });

    if (cached) {
      return NextResponse.json({
        cached: true,
        isFallback: false,
        summaryText: cached.summaryText,
        actionableTip: cached.actionableTip,
        structuredInput: cached.structuredInput,
        createdAt: cached.createdAt,
      });
    }

    // 3. Rate Limit Check: Server-side daily limit (5 autopsies/day per user)
    const dailyCount = await prisma.habitAutopsy.count({
      where: {
        userId,
        autopsyDate,
      },
    });

    if (dailyCount >= DAILY_AUTOPSY_LIMIT) {
      return NextResponse.json(
        {
          error: `Daily autopsy limit reached (${DAILY_AUTOPSY_LIMIT}/${DAILY_AUTOPSY_LIMIT}). Try again tomorrow.`,
          dailyLimit: DAILY_AUTOPSY_LIMIT,
          dailyUsed: dailyCount,
        },
        { status: 429 }
      );
    }

    // 4. Gather structured inputs from Phases 20, 21, and 22
    const [difficultyEval, fingerprint, archetypeResult] = await Promise.all([
      evaluateHabitDifficulty(habitId),
      calculateProcrastinationFingerprint(userId),
      classifyArchetype(userId),
    ]);

    const createdAtMidnight = new Date(habit.createdAt);
    createdAtMidnight.setUTCHours(0, 0, 0, 0);
    const habitAgeDays = Math.floor(
      (now.getTime() - createdAtMidnight.getTime()) / (24 * 60 * 60 * 1000)
    );

    const structuredInput = {
      habit: {
        name: habit.name,
        class: habit.class,
        difficulty: habit.difficulty,
        scheduledDays: habit.scheduledDays,
        habitAgeDays,
      },
      metrics: difficultyEval.metrics || {
        completionRate: 0,
        streakVolatility: 0,
        lastMinuteRate: 0,
        scheduledSlots: 0,
        completionsCount: 0,
      },
      phase20Fingerprint: {
        dangerZoneHours: fingerprint.dangerZoneHours,
        avoidancePattern: fingerprint.avoidancePattern,
        lastMinuteRate: fingerprint.lastMinuteRate,
      },
      phase21Archetype: archetypeResult.archetype,
      phase22DifficultySuggestion: {
        recommendation: difficultyEval.recommendation,
        targetDifficulty: difficultyEval.targetDifficulty,
        status: difficultyEval.status,
      },
    };

    // 5. Call single Gemini SDK wrapper
    const modelOutput = await callAutopsyModel(JSON.stringify(structuredInput));

    // 6. Save to DB for caching (only if not fallback or if valid response)
    if (!modelOutput.isFallback) {
      await prisma.habitAutopsy.create({
        data: {
          userId,
          habitId,
          autopsyDate,
          structuredInput: structuredInput as Prisma.InputJsonValue,
          summaryText: modelOutput.summaryText,
          actionableTip: modelOutput.actionableTip,
        },
      });
    }

    return NextResponse.json({
      cached: false,
      isFallback: modelOutput.isFallback,
      summaryText: modelOutput.summaryText,
      actionableTip: modelOutput.actionableTip,
      structuredInput,
      dailyUsed: dailyCount + 1,
      dailyLimit: DAILY_AUTOPSY_LIMIT,
    });
  } catch (error) {
    console.error("POST habit autopsy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
