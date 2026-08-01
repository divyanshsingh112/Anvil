import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEATURE_ENERGY_CHECKIN } from "@/config/features";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!FEATURE_ENERGY_CHECKIN) {
    return NextResponse.json({ level: null });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({ level: checkin?.level || null });
  } catch (error) {
    console.error("GET energy-checkin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!FEATURE_ENERGY_CHECKIN) {
    return NextResponse.json(
      { error: "Energy check-in feature is currently disabled" },
      { status: 403 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { level } = body;

    if (level !== "low" && level !== "medium" && level !== "high") {
      return NextResponse.json(
        { error: "Level must be 'low', 'medium', or 'high'" },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const checkin = await prisma.energyCheckin.upsert({
      where: {
        userId_date: {
          userId: session.user.id,
          date: today,
        },
      },
      update: {
        level,
      },
      create: {
        userId: session.user.id,
        date: today,
        level,
      },
    });

    return NextResponse.json({
      success: true,
      level: checkin.level,
      date: checkin.date,
    });
  } catch (error) {
    console.error("POST energy-checkin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
