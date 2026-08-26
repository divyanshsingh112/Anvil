import { NextResponse } from "next/server";
import { requireAdminPermission, isSuperAdminTarget } from "@/lib/admin-auth";
import { prismaDirect } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    // 1. Enforce DELETE_USERS permission on caller
    const authResult = await requireAdminPermission("DELETE_USERS");
    if (!authResult.authorized) {
      return authResult.response;
    }
    const actor = authResult.user;

    const { userId: targetUserId } = params;
    if (!targetUserId) {
      return NextResponse.json(
        { error: "User ID parameter is required" },
        { status: 400 }
      );
    }

    // 2. Self-deletion guard: Admins cannot delete their own account
    if (targetUserId === actor.id) {
      return NextResponse.json(
        { error: "Forbidden: Admins cannot delete their own account" },
        { status: 403 }
      );
    }

    // 3. Parse body and validate confirmEmail
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { confirmEmail } = body;
    if (!confirmEmail || typeof confirmEmail !== "string") {
      return NextResponse.json(
        { error: "Confirmation email is required" },
        { status: 400 }
      );
    }

    // 4. Fetch target user
    const targetUser = await prismaDirect.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        role: true,
        isSuperAdmin: true,
        adminPermissions: true,
        createdAt: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // 5. HARD CONSTRAINT: Super admin accounts can NEVER be deleted via API
    if (isSuperAdminTarget(targetUser)) {
      return NextResponse.json(
        { error: "Forbidden: Super admin accounts cannot be deleted via API" },
        { status: 403 }
      );
    }

    // 6. Safeguard: confirmEmail must match target user's actual email
    if (confirmEmail.trim().toLowerCase() !== targetUser.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: `Confirmation email '${confirmEmail}' does not match target user email '${targetUser.email}'`,
        },
        { status: 400 }
      );
    }

    // 7. Atomic transaction: write audit log and cascade deletion
    const auditDetails = `Deleted user account ${targetUser.email} (displayName: "${
      targetUser.displayName
    }", role: ${targetUser.role}, registered: ${targetUser.createdAt.toISOString()})`;

    await prismaDirect.$transaction(async (tx) => {
      // Step A: Write audit log record in same transaction BEFORE delete
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: "DELETE_USER",
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          details: auditDetails,
        },
      });

      // Step B: Explicitly delete unlinked relations (e.g. HabitAutopsy)
      await tx.habitAutopsy.deleteMany({
        where: { userId: targetUserId },
      });

      // Step C: Delete User (cascades all related models with onDelete: Cascade)
      await tx.user.delete({
        where: { id: targetUserId },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted user ${targetUser.email}`,
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email,
        displayName: targetUser.displayName,
      },
    });
  } catch (error) {
    console.error("DELETE /api/admin/users/[userId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
