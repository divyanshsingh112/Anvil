-- AlterTable
ALTER TABLE "User" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "hasSeenConsentPrompt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_pendingEmail_key" ON "User"("pendingEmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
