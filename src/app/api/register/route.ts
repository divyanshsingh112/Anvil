import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, displayName } = body;

    // Validate required fields
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: "Email, password, and display name are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate displayName non-empty
    if (displayName.trim().length === 0) {
      return NextResponse.json(
        { error: "Display name cannot be empty" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If user already exists and is verified, block registration
    if (existingUser && existingUser.emailVerified !== null) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    if (existingUser && existingUser.emailVerified === null) {
      // Pending unverified account: update credentials and generate fresh verification token
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { email: normalizedEmail },
          data: {
            password: hashedPassword,
            displayName: displayName.trim(),
          },
        });

        // Delete any prior unused tokens for this email
        await tx.verificationToken.deleteMany({
          where: { identifier: normalizedEmail },
        });

        // Create new verification token
        await tx.verificationToken.create({
          data: {
            identifier: normalizedEmail,
            token,
            expires,
          },
        });
      });
    } else {
      // New user registration
      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: hashedPassword,
            displayName: displayName.trim(),
            emailVerified: null,
            xp: 0,
            level: 1,
            coins: 0,
            streak: 0,
            momentumScore: 100,
            activeTheme: "Plain",
          },
        });

        // Fetch the free default themes
        const [plainTheme, rpgTheme] = await Promise.all([
          tx.shopItem.findFirst({ where: { name: "Plain", type: "theme" } }),
          tx.shopItem.findFirst({ where: { name: "RPG", type: "theme" } }),
        ]);

        const inventoryData = [];
        if (plainTheme) {
          inventoryData.push({
            userId: newUser.id,
            itemId: plainTheme.id,
            isEquipped: true,
          });
        }
        if (rpgTheme) {
          inventoryData.push({
            userId: newUser.id,
            itemId: rpgTheme.id,
            isEquipped: false,
          });
        }

        if (inventoryData.length > 0) {
          await tx.inventory.createMany({
            data: inventoryData,
          });
        }

        // Clean up any stray tokens and create verification token
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
    }

    // Generate verification URL - ensure production domain in production environment
    let baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl || (process.env.NODE_ENV === "production" && baseUrl.includes("localhost"))) {
      baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "https://anvilapp.online";
    }
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    // Send verification email via Resend
    await sendVerificationEmail(normalizedEmail, verifyUrl);

    // Return response instructing user to check their email (no auto-login)
    return NextResponse.json(
      {
        message: "Registration successful. Please check your email to verify your account.",
        email: normalizedEmail,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
