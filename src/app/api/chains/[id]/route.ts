import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Chain ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const chain = await prisma.questChain.findUnique({
      where: { id },
    });

    if (!chain || chain.userId !== userId) {
      return NextResponse.json({ error: "Chain not found" }, { status: 404 });
    }

    // Hard delete the chain grouping row
    await prisma.questChain.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Chain deleted successfully" });
  } catch (error) {
    console.error("DELETE chain error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
