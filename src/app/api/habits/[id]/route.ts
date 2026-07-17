import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HabitClass, HabitDifficulty } from "@/types";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const habitId = params.id;
    if (!habitId) {
      return NextResponse.json({ error: "Habit ID is required" }, { status: 400 });
    }

    // Verify habit ownership
    const existingHabit = await prisma.habit.findFirst({
      where: {
        id: habitId,
        userId: session.user.id,
      },
    });

    if (!existingHabit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, class: habitClass, difficulty, activeDays } = body;

    const updateData: {
      name?: string;
      class?: HabitClass;
      difficulty?: HabitDifficulty;
      activeDays?: number[];
    } = {};

    // Validate and build update payload
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0 || name.length > 50) {
        return NextResponse.json(
          { error: "Name must be non-empty and at most 50 characters" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (habitClass !== undefined) {
      if (habitClass !== "warrior" && habitClass !== "mage" && habitClass !== "rogue") {
        return NextResponse.json(
          { error: "Class must be warrior, mage, or rogue" },
          { status: 400 }
        );
      }
      updateData.class = habitClass;
    }

    if (difficulty !== undefined) {
      if (difficulty !== "novice" && difficulty !== "adept" && difficulty !== "master") {
        return NextResponse.json(
          { error: "Difficulty must be novice, adept, or master" },
          { status: 400 }
        );
      }
      updateData.difficulty = difficulty;
    }

    if (activeDays !== undefined) {
      if (activeDays === null) {
        updateData.activeDays = [];
      } else {
        if (!Array.isArray(activeDays)) {
          return NextResponse.json(
            { error: "activeDays must be an array of integers" },
            { status: 400 }
          );
        }
        for (const day of activeDays) {
          const parsedDay = parseInt(day, 10);
          if (isNaN(parsedDay) || parsedDay < 0 || parsedDay > 6) {
            return NextResponse.json(
              { error: "activeDays values must be between 0 (Sunday) and 6 (Saturday)" },
              { status: 400 }
            );
          }
        }
        updateData.activeDays = activeDays.map(d => parseInt(d, 10));
      }
    }

    const updatedHabit = await prisma.habit.update({
      where: { id: habitId },
      data: updateData,
    });

    return NextResponse.json(updatedHabit);
  } catch (error) {
    console.error("PUT habit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const habitId = params.id;
    if (!habitId) {
      return NextResponse.json({ error: "Habit ID is required" }, { status: 400 });
    }

    // Verify ownership
    const existingHabit = await prisma.habit.findFirst({
      where: {
        id: habitId,
        userId: session.user.id,
      },
    });

    if (!existingHabit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    // Soft delete: set archivedAt = now()
    await prisma.habit.update({
      where: { id: habitId },
      data: { archivedAt: new Date() },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE habit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
