-- Phase 23: Create HabitAutopsy table for caching Gemini habit autopsies
CREATE TABLE "HabitAutopsy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "autopsyDate" DATE NOT NULL,
    "structuredInput" JSONB NOT NULL,
    "summaryText" TEXT NOT NULL,
    "actionableTip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitAutopsy_pkey" PRIMARY KEY ("id")
);

-- Unique index to enforce single autopsy per habit per date (caching key)
CREATE UNIQUE INDEX "HabitAutopsy_habitId_autopsyDate_key" ON "HabitAutopsy"("habitId", "autopsyDate");

-- Index for user-level daily rate limit queries
CREATE INDEX "HabitAutopsy_userId_autopsyDate_idx" ON "HabitAutopsy"("userId", "autopsyDate");
