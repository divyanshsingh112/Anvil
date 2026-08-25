import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-client";

// In-memory rate limiting map: email -> timestamp in ms
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const now = Date.now();

    // Check rate limit (1 resend per email per 60 seconds)
    const lastSent = rateLimitMap.get(normalizedEmail);
    if (lastSent && now - lastSent < RATE_LIMIT_WINDOW_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastSent)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds}s before requesting another verification email.` },
        { status: 429 }
      );
    }

    // Generic response message to prevent account enumeration
    const genericSuccessResponse = {
      message: "If an unverified account exists with that email, a verification link has been sent.",
    };

    // Look up user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If user does not exist or is already verified, return generic success without sending
    if (!user || user.emailVerified !== null) {
      return NextResponse.json(genericSuccessResponse, { status: 200 });
    }

    // Update rate limit timestamp
    rateLimitMap.set(normalizedEmail, now);

    // Clean up old entries in rateLimitMap periodically
    if (rateLimitMap.size > 5000) {
      rateLimitMap.forEach((timestamp, key) => {
        if (now - timestamp > RATE_LIMIT_WINDOW_MS) {
          rateLimitMap.delete(key);
        }
      });
    }

    // Generate fresh verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate/delete any prior unused tokens for this email and save new token
    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      });

      await tx.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token,
          expires,
        },
      });
    });

    // Generate verification link
    let baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl || (process.env.NODE_ENV === "production" && baseUrl.includes("localhost"))) {
      baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://anvilapp.online";
    }
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    // Send email via Resend
    await sendVerificationEmail(normalizedEmail, verifyUrl);

    return NextResponse.json(genericSuccessResponse, { status: 200 });
  } catch (error) {
    console.error("[resend-verification] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
