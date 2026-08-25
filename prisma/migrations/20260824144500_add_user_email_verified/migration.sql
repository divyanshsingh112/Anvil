-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);

-- Data backfill: grandfather existing users by setting emailVerified to createdAt
UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;
