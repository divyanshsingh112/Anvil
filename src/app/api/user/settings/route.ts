import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        pendingEmail: true,
        password: true,
        trainingDataConsent: true,
        trainingConsentUpdatedAt: true,
        allowChallenges: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      email: user.email,
      pendingEmail: user.pendingEmail,
      hasPassword: user.password !== null,
      trainingDataConsent: user.trainingDataConsent,
      trainingConsentUpdatedAt: user.trainingConsentUpdatedAt,
      allowChallenges: user.allowChallenges ?? true,
    });
  } catch (error) {
    console.error("GET /api/user/settings error:", error);
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
