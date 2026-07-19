-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "consumedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "freeFreezeCharges" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freezeActiveDate" DATE,
ADD COLUMN     "lastShieldRecharge" TIMESTAMP(3),
ADD COLUMN     "streakShieldActive" BOOLEAN NOT NULL DEFAULT false;
