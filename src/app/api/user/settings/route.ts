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
    const { trainingDataConsent, allowChallenges } = body;

    if (
      typeof trainingDataConsent !== "boolean" &&
      typeof allowChallenges !== "boolean"
    ) {
      return NextResponse.json(
        { error: "At least one valid boolean parameter (trainingDataConsent or allowChallenges) is required" },
        { status: 400 }
      );
    }

    const updateData: {
      trainingDataConsent?: boolean;
      trainingConsentUpdatedAt?: Date;
      allowChallenges?: boolean;
    } = {};

    if (typeof trainingDataConsent === "boolean") {
      updateData.trainingDataConsent = trainingDataConsent;
      updateData.trainingConsentUpdatedAt = new Date();
    }

    if (typeof allowChallenges === "boolean") {
      updateData.allowChallenges = allowChallenges;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        trainingDataConsent: true,
        trainingConsentUpdatedAt: true,
        allowChallenges: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("POST /api/user/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
