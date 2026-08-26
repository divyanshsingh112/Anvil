import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { deleteUserWithCascade } from "@/lib/user-deletion";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    // 1. Enforce authenticated session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Fetch caller user record
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        role: true,
        isSuperAdmin: true,
        password: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. HARD CONSTRAINT: Super admin accounts can NEVER be deleted
    if (user.isSuperAdmin === true) {
      return NextResponse.json(
        { error: "Super admin accounts cannot be deleted" },
        { status: 403 }
      );
    }

    // 4. Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { currentPassword, confirmEmail } = body;

    // 5. Validate typed confirmEmail
    if (!confirmEmail || typeof confirmEmail !== "string") {
      return NextResponse.json(
        { error: "Confirmation email is required" },
        { status: 400 }
      );
    }

    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: `Confirmation email does not match your account email '${user.email}'`,
        },
        { status: 400 }
      );
    }

    // 6. Validate password if account has a password set
    if (user.password !== null) {
      if (!currentPassword || typeof currentPassword !== "string") {
        return NextResponse.json(
          { error: "Password is required to delete this account" },
          { status: 400 }
        );
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 400 }
        );
      }
    }

    // 7. Execute shared atomic cascading deletion
    const auditDetails = `Self-service account deletion by user ${user.email} (displayName: "${
      user.displayName
    }", role: ${user.role}, registered: ${user.createdAt.toISOString()})`;

    await deleteUserWithCascade({
      userId: user.id,
      actor: { id: user.id, email: user.email },
      action: "SELF_DELETE_ACCOUNT",
      details: auditDetails,
    });

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/user/account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
