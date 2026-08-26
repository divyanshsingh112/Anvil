import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty on basic dismissal / close X
      body = {};
    }

    const { consent } = body;

    const updateData: Prisma.UserUpdateInput = {
      hasSeenConsentPrompt: true,
    };

    // Only opt-in if explicitly true. If false, explicitly opt-out.
    // If undefined (e.g. dismissed via X without choice), keep consent false / do not opt in.
    if (typeof consent === "boolean") {
      updateData.trainingDataConsent = consent;
      updateData.trainingConsentUpdatedAt = new Date();
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        hasSeenConsentPrompt: true,
        trainingDataConsent: true,
        trainingConsentUpdatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      hasSeenConsentPrompt: updatedUser.hasSeenConsentPrompt,
      trainingDataConsent: updatedUser.trainingDataConsent,
      trainingConsentUpdatedAt: updatedUser.trainingConsentUpdatedAt,
    });
  } catch (error) {
    console.error("POST /api/user/consent-prompt-seen error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
