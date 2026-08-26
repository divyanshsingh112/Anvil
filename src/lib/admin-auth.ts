import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export type AdminPermission = "VIEW_USERS" | "DELETE_USERS" | "MANAGE_ADMINS";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isSuperAdmin: boolean;
  adminPermissions: string[];
}

export type AdminAuthSuccess = {
  authorized: true;
  user: AdminUser;
  status: 200;
  response: null;
  error?: never;
};

export type AdminAuthFailure = {
  authorized: false;
  user: null;
  status: 401 | 403;
  error: string;
  response: NextResponse;
};

export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure;

/**
 * Centralized server-side permission-checking layer.
 * 
 * Enforces role-based admin access control:
 * 1. Checks current NextAuth session (401 if unauthenticated).
 * 2. Fetches user from DB.
 * 3. isSuperAdmin === true always passes (bypasses granular checks).
 * 4. role !== 'ADMIN' returns 403 Forbidden.
 * 5. Checks if requested permission is in adminPermissions array (403 if missing).
 * 6. Returns authorized admin user context for caller and audit logging.
 * 
 * @param permission The required admin permission ('VIEW_USERS' | 'DELETE_USERS' | 'MANAGE_ADMINS')
 * @param sessionOverride Optional session override for unit/integration testing
 */
export async function requireAdminPermission(
  permission: AdminPermission,
  sessionOverride?: any
): Promise<AdminAuthResult> {
  try {
    const session = sessionOverride !== undefined 
      ? sessionOverride 
      : await getServerSession(authOptions);

    if (!session?.user?.id) {
      return {
        authorized: false,
        user: null,
        status: 401,
        error: "Unauthorized",
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isSuperAdmin: true,
        adminPermissions: true,
      },
    });

    if (!user) {
      return {
        authorized: false,
        user: null,
        status: 401,
        error: "Unauthorized: User not found",
        response: NextResponse.json(
          { error: "Unauthorized: User not found" },
          { status: 401 }
        ),
      };
    }

    // Defensive handling: Treat null/undefined adminPermissions as empty array
    const adminPermissions: string[] = Array.isArray(user.adminPermissions)
      ? user.adminPermissions
      : [];

    const adminUser: AdminUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      adminPermissions,
    };

    // 1. Super Admin bypass: Always passes, regardless of the adminPermissions array
    if (user.isSuperAdmin === true) {
      return {
        authorized: true,
        user: adminUser,
        status: 200,
        response: null,
      };
    }

    // 2. Role Check: Must be ADMIN
    if (user.role !== Role.ADMIN) {
      return {
        authorized: false,
        user: null,
        status: 403,
        error: "Forbidden: Admin role required",
        response: NextResponse.json(
          { error: "Forbidden: Admin role required" },
          { status: 403 }
        ),
      };
    }

    // 3. Granular Permission Check: Requested permission must exist in adminPermissions
    if (!adminPermissions.includes(permission)) {
      return {
        authorized: false,
        user: null,
        status: 403,
        error: `Forbidden: Missing required permission '${permission}'`,
        response: NextResponse.json(
          { error: `Forbidden: Missing required permission '${permission}'` },
          { status: 403 }
        ),
      };
    }

    return {
      authorized: true,
      user: adminUser,
      status: 200,
      response: null,
    };
  } catch (error) {
    console.error("requireAdminPermission error:", error);
    return {
      authorized: false,
      user: null,
      status: 403,
      error: "Forbidden: Authorization check failed",
      response: NextResponse.json(
        { error: "Forbidden: Authorization check failed" },
        { status: 403 }
      ),
    };
  }
}

/**
 * Writes an immutable audit trail entry to AdminAuditLog.
 * Every admin route MUST invoke this helper upon performing any administrative action.
 */
export async function logAdminAction(
  actorId: string,
  actorEmail: string,
  action: string,
  targetUserId?: string | null,
  targetEmail?: string | null,
  details?: string | null
) {
  return await prisma.adminAuditLog.create({
    data: {
      actorId,
      actorEmail,
      action,
      targetUserId: targetUserId ?? null,
      targetEmail: targetEmail ?? null,
      details: details ?? null,
    },
  });
}

/**
 * Hard constraint helper: A super admin's account can NEVER be targeted for DELETE_USERS
 * or role/permission changes by ANYONE (including other admins or themselves via API).
 */
export function isSuperAdminTarget(targetUser: { isSuperAdmin?: boolean | null } | null | undefined): boolean {
  return targetUser?.isSuperAdmin === true;
}
