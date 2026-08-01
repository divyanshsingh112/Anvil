-- Phase 21: Add archetype versioning fields to MlUserProfile
-- Enables tracking which classifier version produced the label
-- and when classification was last computed (separate from lastComputedAt
-- which tracks momentum/fingerprint)

ALTER TABLE "MlUserProfile" ADD COLUMN "archetypeVersion" INTEGER DEFAULT 1;
ALTER TABLE "MlUserProfile" ADD COLUMN "archetypeComputedAt" TIMESTAMP(3);
