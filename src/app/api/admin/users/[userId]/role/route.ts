import { NextResponse } from "next/server";
import { requireAdminPermission, logAdminAction, isSuperAdminTarget } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_PERMISSIONS = ["VIEW_USERS", "DELETE_USERS", "MANAGE_ADMINS"] as const;
type ValidPermission = (typeof VALID_PERMISSIONS)[number];

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    // 1. Enforce MANAGE_ADMINS permission on caller
    const authResult = await requireAdminPermission("MANAGE_ADMINS");
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

    // 2. Self-modification guard: Admins cannot modify their own role/permissions
    if (targetUserId === actor.id) {
      return NextResponse.json(
        { error: "Forbidden: Admins cannot modify their own role or permissions" },
        { status: 403 }
      );
    }

    // 3. Parse and validate body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { role, permissions } = body;

    if (role !== "USER" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Invalid role. Role must be 'USER' or 'ADMIN'" },
        { status: 400 }
      );
    }

    let finalPermissions: string[] = [];

    if (role === "ADMIN") {
      if (permissions !== undefined) {
        if (!Array.isArray(permissions)) {
          return NextResponse.json(
            { error: "Permissions must be an array of valid strings" },
            { status: 400 }
          );
        }

        const invalidPermissions = permissions.filter(
          (p) => typeof p !== "string" || !VALID_PERMISSIONS.includes(p as ValidPermission)
        );

        if (invalidPermissions.length > 0) {
          return NextResponse.json(
            {
              error: `Invalid permission(s): ${invalidPermissions.join(
                ", "
              )}. Allowed permissions are: ${VALID_PERMISSIONS.join(", ")}`,
            },
            { status: 400 }
          );
        }

        finalPermissions = Array.from(new Set(permissions));
      }
    } else {
      // role === 'USER' -> permissions are cleared/ignored to empty array
      finalPermissions = [];
    }

    // 4. Fetch target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        role: true,
        isSuperAdmin: true,
        adminPermissions: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // 5. HARD CONSTRAINT: Super admin accounts can NEVER be targeted for role/permission changes
    if (isSuperAdminTarget(targetUser)) {
      return NextResponse.json(
        { error: "Forbidden: Super admin accounts cannot be modified via API" },
        { status: 403 }
      );
    }

    // 6. Determine action for audit log
    let action = "UPDATE_ROLE";
    if (targetUser.role === Role.USER && role === Role.ADMIN) {
      action = "GRANT_ADMIN";
    } else if (targetUser.role === Role.ADMIN && role === Role.USER) {
      action = "REVOKE_ADMIN";
    } else if (targetUser.role === Role.ADMIN && role === Role.ADMIN) {
      action = "UPDATE_PERMISSIONS";
    }

    // 7. Update target user
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        role: role as Role,
        adminPermissions: finalPermissions,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        isSuperAdmin: true,
        adminPermissions: true,
        createdAt: true,
      },
    });

    // 8. Log admin action to AdminAuditLog
    const auditDetails = `Role changed from ${targetUser.role} to ${role}. Permissions: [${finalPermissions.join(
      ", "
    )}]`;

    await logAdminAction(
      actor.id,
      actor.email,
      action,
      targetUser.id,
      targetUser.email,
      auditDetails
    );

    return NextResponse.json({
      user: updatedUser,
      action,
      message: `Successfully updated ${targetUser.email} to ${role}`,
    });
  } catch (error) {
    console.error("POST /api/admin/users/[userId]/role error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
