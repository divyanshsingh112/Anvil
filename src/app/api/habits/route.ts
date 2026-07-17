import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get("year");
    const monthStr = searchParams.get("month");

    if (!yearStr || !monthStr) {
      return NextResponse.json(
        { error: "Year and month query parameters are required" },
        { status: 400 }
      );
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid year or month format" },
        { status: 400 }
      );
    }

    const habits = await prisma.habit.findMany({
      where: {
        userId: session.user.id,
        year,
        month,
        archivedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(habits);
  } catch (error) {
    console.error("GET habits error:", error);
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

    const body = await request.json();
    const { name, class: habitClass, difficulty, year, month, activeDays } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 50) {
      return NextResponse.json(
        { error: "Name is required, non-empty, and must be at most 50 characters" },
        { status: 400 }
      );
    }

    // Validate class
    if (habitClass !== "warrior" && habitClass !== "mage" && habitClass !== "rogue") {
      return NextResponse.json(
        { error: "Class must be warrior, mage, or rogue" },
        { status: 400 }
      );
    }

    // Validate difficulty
    if (difficulty !== "novice" && difficulty !== "adept" && difficulty !== "master") {
      return NextResponse.json(
        { error: "Difficulty must be novice, adept, or master" },
        { status: 400 }
      );
    }

    // Validate year & month
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);
    if (isNaN(parsedYear) || String(parsedYear).length !== 4) {
      return NextResponse.json(
        { error: "Year must be a valid 4-digit integer" },
        { status: 400 }
      );
    }
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return NextResponse.json(
        { error: "Month must be between 1 and 12" },
        { status: 400 }
      );
    }

    // Validate activeDays if provided
    let parsedActiveDays: number[] | null = null;
    if (activeDays !== undefined && activeDays !== null) {
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
      parsedActiveDays = activeDays.map(d => parseInt(d, 10));
    }

    const habit = await prisma.habit.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        class: habitClass,
        difficulty,
        year: parsedYear,
        month: parsedMonth,
        activeDays: parsedActiveDays === null ? undefined : parsedActiveDays,
      },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error("POST habit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
