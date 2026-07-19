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
      // 1. Fetch inventory row to check ownership
      const inventoryRow = await tx.inventory.findFirst({
        where: { userId, itemId },
        include: { item: true }
      });

      // Do not leak whether the item exists at all if not owned
      if (!inventoryRow) {
        throw new Error("NOT_OWNED");
      }

      const itemType = inventoryRow.item.type;

      // 2. Unequip any other equipped item of the same type
      // Get all equipped inventory items of this type for the user
      const otherEquipped = await tx.inventory.findMany({
        where: {
          userId,
          isEquipped: true,
          item: {
            type: itemType
          }
        }
      });

      if (otherEquipped.length > 0) {
        await tx.inventory.updateMany({
          where: {
            id: {
              in: otherEquipped.map((e) => e.id)
            }
          },
          data: {
            isEquipped: false
          }
        });
      }

      // 3. Equip the target item
      const updatedInventory = await tx.inventory.update({
        where: { id: inventoryRow.id },
        data: { isEquipped: true },
        include: { item: true }
      });

      // 4. If it's a theme, update the User.activeTheme field
      if (itemType === "theme") {
        await tx.user.update({
          where: { id: userId },
          data: { activeTheme: inventoryRow.item.name }
        });
      }

      return {
        equippedItemId: itemId,
        activeTheme: itemType === "theme" ? inventoryRow.item.name : undefined,
        inventory: updatedInventory
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorObj = error as Error;
    if (errorObj.message === "NOT_OWNED") {
      return NextResponse.json({ error: "Item not found in inventory" }, { status: 404 });
    }
    console.error("POST shop equip error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
