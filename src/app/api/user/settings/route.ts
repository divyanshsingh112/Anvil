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
        avatarUrl: true,
        pendingEmail: true,
        displayName: true,
        username: true,
        phone: true,
        gender: true,
        age: true,
        password: true,
        trainingDataConsent: true,
        trainingConsentUpdatedAt: true,
        hasSeenConsentPrompt: true,
        allowChallenges: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      email: user.email,
      avatarUrl: user.avatarUrl,
      pendingEmail: user.pendingEmail,
      displayName: user.displayName,
      username: user.username,
      phone: user.phone,
      gender: user.gender,
      age: user.age,
      hasPassword: user.password !== null,
      trainingDataConsent: user.trainingDataConsent,
      trainingConsentUpdatedAt: user.trainingConsentUpdatedAt,
      hasSeenConsentPrompt: user.hasSeenConsentPrompt ?? false,
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
    const {
      trainingDataConsent,
      allowChallenges,
      displayName,
      username,
      phone,
      gender,
      age,
    } = body;

    const updateData: {
      trainingDataConsent?: boolean;
      trainingConsentUpdatedAt?: Date;
      allowChallenges?: boolean;
      displayName?: string;
      username?: string | null;
      phone?: string | null;
      gender?: string | null;
      age?: number | null;
    } = {};

    // 1. Consent Settings
    if (typeof trainingDataConsent === "boolean") {
      updateData.trainingDataConsent = trainingDataConsent;
      updateData.trainingConsentUpdatedAt = new Date();
    }

    if (typeof allowChallenges === "boolean") {
      updateData.allowChallenges = allowChallenges;
    }

    // 2. Display Name: non-empty, max 50 chars
    if (displayName !== undefined) {
      if (typeof displayName !== "string" || displayName.trim().length === 0) {
        return NextResponse.json(
          { error: "Display name cannot be empty" },
          { status: 400 }
        );
      }
      const trimmedName = displayName.trim();
      if (trimmedName.length > 50) {
        return NextResponse.json(
          { error: "Display name cannot exceed 50 characters" },
          { status: 400 }
        );
      }
      updateData.displayName = trimmedName;
    }

    // 3. Username: 3-20 chars, alphanumeric + underscore only, unique (case-insensitive check)
    if (username !== undefined) {
      if (username === null || (typeof username === "string" && username.trim() === "")) {
        updateData.username = null;
      } else if (typeof username === "string") {
        const trimmedUsername = username.trim();
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(trimmedUsername)) {
          return NextResponse.json(
            { error: "Username must be 3-20 characters and contain only letters, numbers, and underscores" },
            { status: 400 }
          );
        }

        // Case-insensitive uniqueness check against other users
        const conflict = await prisma.user.findFirst({
          where: {
            username: { equals: trimmedUsername, mode: "insensitive" },
            id: { not: userId },
          },
          select: { id: true },
        });

        if (conflict) {
          return NextResponse.json(
            { error: "This username is already taken" },
            { status: 409 }
          );
        }

        updateData.username = trimmedUsername;
      } else {
        return NextResponse.json(
          { error: "Invalid username format" },
          { status: 400 }
        );
      }
    }

    // 4. Phone: optional, reject only if under 7 digits
    if (phone !== undefined) {
      if (phone === null || (typeof phone === "string" && phone.trim() === "")) {
        updateData.phone = null;
      } else if (typeof phone === "string") {
        const trimmedPhone = phone.trim();
        const digits = trimmedPhone.replace(/\D/g, "");
        if (digits.length < 7) {
          return NextResponse.json(
            { error: "Phone number must contain at least 7 digits" },
            { status: 400 }
          );
        }
        if (trimmedPhone.length > 30) {
          return NextResponse.json(
            { error: "Phone number cannot exceed 30 characters" },
            { status: 400 }
          );
        }
        updateData.phone = trimmedPhone;
      } else {
        return NextResponse.json(
          { error: "Invalid phone number format" },
          { status: 400 }
        );
      }
    }

    // 5. Gender: free text, max length guard only
    if (gender !== undefined) {
      if (gender === null || (typeof gender === "string" && gender.trim() === "")) {
        updateData.gender = null;
      } else if (typeof gender === "string") {
        const trimmedGender = gender.trim();
        if (trimmedGender.length > 50) {
          return NextResponse.json(
            { error: "Gender cannot exceed 50 characters" },
            { status: 400 }
          );
        }
        updateData.gender = trimmedGender;
      } else {
        return NextResponse.json(
          { error: "Invalid gender format" },
          { status: 400 }
        );
      }
    }

    // 6. Age: optional integer, must be 13-120 if provided
    if (age !== undefined) {
      if (age === null || age === "") {
        updateData.age = null;
      } else {
        const parsedAge = typeof age === "number" ? age : parseInt(String(age), 10);
        if (
          isNaN(parsedAge) ||
          !Number.isInteger(parsedAge) ||
          parsedAge < 13 ||
          parsedAge > 120
        ) {
          return NextResponse.json(
            { error: "Age must be an integer between 13 and 120" },
            { status: 400 }
          );
        }
        updateData.age = parsedAge;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "At least one valid field must be provided for update" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        username: true,
        phone: true,
        gender: true,
        age: true,
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
