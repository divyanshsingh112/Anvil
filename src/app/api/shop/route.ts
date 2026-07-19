import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();

    // Query active items: not limited, or limited but not expired
    const activeItems = await prisma.shopItem.findMany({
      where: {
        OR: [
          { isLimited: false },
          {
            AND: [
              { isLimited: true },
              { availableUntil: { gt: now } }
            ]
          }
        ]
      }
    });

    // Query user inventory to join owned status
    const inventory = await prisma.inventory.findMany({
      where: { userId }
    });

    // Create mappings for fast lookup
    const ownedItemIds = new Set(inventory.map((inv) => inv.itemId));
    const equippedItemIds = new Set(inventory.filter((inv) => inv.isEquipped).map((inv) => inv.itemId));

    // Combine item details with ownership & equip state
    const result = activeItems.map((item) => ({
      ...item,
      owned: ownedItemIds.has(item.id),
      isEquipped: equippedItemIds.has(item.id),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET shop error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
