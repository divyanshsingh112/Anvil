import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Define today's date exactly like the toggle route (UTC midnight start)
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch user to check existing active freeze date
      const user = await tx.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      if (user.freezeActiveDate) {
        const activeDate = new Date(user.freezeActiveDate);
        if (
          activeDate.getUTCFullYear() === today.getUTCFullYear() &&
          activeDate.getUTCMonth() === today.getUTCMonth() &&
          activeDate.getUTCDate() === today.getUTCDate()
        ) {
          throw new Error("ALREADY_FROZEN_TODAY");
        }
      }

      // 2. Find an unconsumed Streak Freeze in inventory
      const streakFreezeInventory = await tx.inventory.findFirst({
        where: {
          userId,
          consumedAt: null,
          item: {
            name: "Streak Freeze",
            type: "consumable"
          }
        },
        include: {
          item: true
        }
      });

      if (!streakFreezeInventory) {
        throw new Error("NO_FREEZES_AVAILABLE");
      }

      // 3. Mark the inventory item as consumed
      await tx.inventory.update({
        where: { id: streakFreezeInventory.id },
        data: { consumedAt: now }
      });

      // 4. Set the freeze active date on the user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { freezeActiveDate: today }
      });

      return {
        message: "Streak Freeze applied successfully for today",
        freezeActiveDate: updatedUser.freezeActiveDate,
        freeFreezeCharges: updatedUser.freeFreezeCharges,
        streakShieldActive: updatedUser.streakShieldActive
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorObj = error as Error;
    if (errorObj.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (errorObj.message === "ALREADY_FROZEN_TODAY") {
      return NextResponse.json(
        { error: "A streak freeze is already active for today" },
        { status: 400 }
      );
    }
    if (errorObj.message === "NO_FREEZES_AVAILABLE") {
      return NextResponse.json(
        { error: "No unused Streak Freeze items found in your inventory" },
        { status: 400 }
      );
    }
    console.error("POST use-freeze error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
