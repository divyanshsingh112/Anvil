-- Phase 22: Add cooldown tracking fields to Habit
ALTER TABLE "Habit" ADD COLUMN "lastDifficultySuggestionAt" TIMESTAMP(3);
ALTER TABLE "Habit" ADD COLUMN "lastDifficultySuggestionAction" TEXT;
