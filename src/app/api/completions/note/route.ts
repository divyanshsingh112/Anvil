import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/completions/note
 * Adds or updates an optional text note on an existing completion.
 *
 * Body: { completionId: string, note: string }
 * Max characters: 100
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { completionId, note } = body;

    if (!completionId) {
      return NextResponse.json(
        { error: "completionId is required" },
        { status: 400 }
      );
    }

    // Server-side length validation
    const trimmedNote = typeof note === "string" ? note.trim() : "";
    if (trimmedNote.length > 100) {
      return NextResponse.json(
        { error: "Note must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Verify completion ownership and existence
    const completion = await prisma.completion.findFirst({
      where: {
        id: completionId,
        userId: session.user.id,
      },
    });

    if (!completion) {
      // 404 to prevent completion ID enumeration probing
      return NextResponse.json(
        { error: "Completion not found" },
        { status: 404 }
      );
    }

    // Update Note field
    const updatedCompletion = await prisma.completion.update({
      where: { id: completionId },
      data: {
        note: trimmedNote || null,
      },
    });

    return NextResponse.json(updatedCompletion);
  } catch (error) {
    console.error("PATCH completions/note error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
