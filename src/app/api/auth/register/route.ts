import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Execute in a transaction to ensure user and initial inventory are created atomically
    const user = await prisma.$transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          displayName: displayName.trim(),
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

      return newUser;
    });

    // Return user WITHOUT password
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
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
