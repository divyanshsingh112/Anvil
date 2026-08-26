-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" UUID,
    "targetEmail" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- Enable and Force Row Level Security on AdminAuditLog
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAuditLog" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'AdminAuditLog' AND policyname = 'service_role_all_adminauditlog'
  ) THEN
    CREATE POLICY "service_role_all_adminauditlog" ON "AdminAuditLog" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Bootstrap initial Super Admin (direct migration SQL only, immutable via application)
UPDATE "User"
SET "role" = 'ADMIN',
    "isSuperAdmin" = true,
    "adminPermissions" = ARRAY['VIEW_USERS', 'DELETE_USERS', 'MANAGE_ADMINS']
WHERE "email" = 'sdivyansh110205@gmail.com';
