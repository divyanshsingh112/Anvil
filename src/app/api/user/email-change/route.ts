import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma, prismaDirect } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-client";

// In-memory rate limiting map: userId -> timestamp in ms
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { currentPassword, newEmail } = body;

    // Validate inputs
    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      );
    }

    if (!newEmail || typeof newEmail !== "string") {
      return NextResponse.json(
        { error: "New email address is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedNewEmail = newEmail.toLowerCase().trim();

    if (!emailRegex.test(normalizedNewEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Rate limiting check (60s cooldown per user)
    const now = Date.now();
    const lastRequestTime = rateLimitMap.get(userId);
    if (lastRequestTime && now - lastRequestTime < RATE_LIMIT_WINDOW_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastRequestTime)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds}s before requesting another email change.` },
        { status: 429 }
      );
    }

    // Look up logged in user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        pendingEmail: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if account has a password (Google OAuth users will have null password)
    if (!user.password) {
      return NextResponse.json(
        { error: "Accounts created via Google sign-in cannot change email this way" },
        { status: 400 }
      );
    }

    // Verify current password against stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Incorrect current password" },
        { status: 400 }
      );
    }

    // Ensure new email is different from current active email
    if (normalizedNewEmail === user.email.toLowerCase().trim()) {
      return NextResponse.json(
        { error: "New email must be different from your current email" },
        { status: 400 }
      );
    }

    // Validate newEmail is not in use as existing User.email or another User.pendingEmail
    const conflictUser = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: user.id } },
          {
            OR: [
              { email: normalizedNewEmail },
              { pendingEmail: normalizedNewEmail },
            ],
          },
        ],
      },
      select: { id: true, email: true, pendingEmail: true },
    });

    if (conflictUser) {
      return NextResponse.json(
        { error: "This email address is already in use or has a pending change on another account" },
        { status: 409 }
      );
    }

    // Update rate limit timestamp
    rateLimitMap.set(userId, now);

    // Periodically clean up rate limit map
    if (rateLimitMap.size > 5000) {
      rateLimitMap.forEach((ts, key) => {
        if (now - ts > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
      });
    }

    // Generate fresh verification token (24-hour expiration)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Save pending change in database atomically
    await prismaDirect.$transaction(async (tx) => {
      // Invalidate prior unused tokens for any existing pending email or the new email
      if (user.pendingEmail) {
        await tx.verificationToken.deleteMany({
          where: { identifier: user.pendingEmail },
        });
      }
      await tx.verificationToken.deleteMany({
        where: { identifier: normalizedNewEmail },
      });

      // Update user pendingEmail
      await tx.user.update({
        where: { id: user.id },
        data: { pendingEmail: normalizedNewEmail },
      });

      // Create new verification token for the new email
      await tx.verificationToken.create({
        data: {
          identifier: normalizedNewEmail,
          token,
          expires,
        },
      });
    });

    // Build confirmation link targeting /api/auth/confirm-email-change
    let baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl || (process.env.NODE_ENV === "production" && baseUrl.includes("localhost"))) {
      baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://anvilapp.online";
    }
    const confirmUrl = `${baseUrl}/api/auth/confirm-email-change?token=${token}`;

    // Send confirmation email to the NEW email address
    await sendVerificationEmail(normalizedNewEmail, confirmUrl);

    return NextResponse.json({
      message: "Confirmation link sent to your new email address. Please check your inbox.",
      pendingEmail: normalizedNewEmail,
    });
  } catch (error) {
    console.error("POST /api/user/email-change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pendingEmail: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.pendingEmail) {
      await prismaDirect.$transaction(async (tx) => {
        await tx.verificationToken.deleteMany({
          where: { identifier: user.pendingEmail! },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { pendingEmail: null },
        });
      });
    }

    return NextResponse.json({
      message: "Pending email change cancelled successfully",
    });
  } catch (error) {
    console.error("DELETE /api/user/email-change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
