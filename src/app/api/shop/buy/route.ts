import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is a required field" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch item
      const item = await tx.shopItem.findUnique({
        where: { id: itemId }
      });

      if (!item) {
        throw new Error("ITEM_NOT_FOUND");
      }

      // 2. Check ownership
      const existingOwned = await tx.inventory.findFirst({
        where: { userId, itemId }
      });

      if (existingOwned) {
        throw new Error("ALREADY_OWNED");
      }

      // 3. Fetch user balance
      const user = await tx.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      if (user.coins < item.priceCoins) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      // 4. Deduct coins and add to inventory
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: {
            decrement: item.priceCoins
          }
        }
      });

      const inventoryRow = await tx.inventory.create({
        data: {
          userId,
          itemId,
          isEquipped: false
        },
        include: {
          item: true
        }
      });

      return {
        coins: updatedUser.coins,
        inventory: inventoryRow
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorObj = error as Error;
    if (errorObj.message === "ITEM_NOT_FOUND") {
      return NextResponse.json({ error: "Shop item not found" }, { status: 404 });
    }
    if (errorObj.message === "ALREADY_OWNED") {
      return NextResponse.json({ error: "Item already owned" }, { status: 409 });
    }
    if (errorObj.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (errorObj.message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 });
    }
    console.error("POST shop buy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
