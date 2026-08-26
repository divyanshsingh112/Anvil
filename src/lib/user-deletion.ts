import { prismaDirect } from "@/lib/prisma";

export interface DeleteUserOptions {
  userId: string;
  actor: {
    id: string;
    email: string;
  };
  action: "DELETE_USER" | "SELF_DELETE_ACCOUNT";
  details?: string;
}

/**
 * Shared atomic cascading user deletion service.
 * Used by both admin-initiated deletions (DELETE /api/admin/users/[userId])
 * and self-service account deletions (DELETE /api/user/account).
 */
export async function deleteUserWithCascade(options: DeleteUserOptions) {
  const { userId, actor, action, details } = options;

  return await prismaDirect.$transaction(async (tx) => {
    // 1. Fetch user to verify existence and capture metadata
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        role: true,
        isSuperAdmin: true,
        adminPermissions: true,
        createdAt: true,
        pendingEmail: true,
      },
    });

    if (!user) {
      throw new Error("UserNotFound");
    }

    const auditDetails =
      details ||
      `Deleted user account ${user.email} (displayName: "${user.displayName}", role: ${
        user.role
      }, registered: ${user.createdAt.toISOString()})`;

    // 2. Write immutable audit log record in the same atomic transaction BEFORE deletion
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action,
        targetUserId: user.id,
        targetEmail: user.email,
        details: auditDetails,
      },
    });

    // 3. Explicitly purge unlinked tables / verification tokens
    await tx.habitAutopsy.deleteMany({
      where: { userId },
    });

    if (user.pendingEmail) {
      await tx.verificationToken.deleteMany({
        where: { identifier: user.pendingEmail },
      });
    }
    await tx.verificationToken.deleteMany({
      where: { identifier: user.email },
    });

    // 4. Delete User (cascades all related models with onDelete: Cascade)
    await tx.user.delete({
      where: { id: userId },
    });

    return user;
  });
}
