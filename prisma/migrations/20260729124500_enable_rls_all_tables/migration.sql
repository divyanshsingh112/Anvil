-- SECURITY FIX: Enable Row-Level Security on all tables
-- 
-- This enables RLS with a default-deny policy (no permissive policies added).
-- Effect:
--   - Supabase REST API (anon/authenticated roles) → BLOCKED from all tables
--   - Our Prisma backend (postgres superuser role)  → UNAFFECTED (bypasses RLS)
--
-- This migration seals the auto-generated Supabase REST API attack surface
-- while keeping our Next.js API routes working normally via direct Postgres.

-- Core user data (CRITICAL — contains hashed passwords)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Habit tracking
ALTER TABLE "Habit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Completion" ENABLE ROW LEVEL SECURITY;

-- Stats & progression
ALTER TABLE "UserStats" ENABLE ROW LEVEL SECURITY;

-- Shop & inventory
ALTER TABLE "ShopItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;

-- Achievements
ALTER TABLE "Achievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAchievement" ENABLE ROW LEVEL SECURITY;

-- Boss battles
ALTER TABLE "BossBattle" ENABLE ROW LEVEL SECURITY;

-- Quest chains
ALTER TABLE "QuestChain" ENABLE ROW LEVEL SECURITY;

-- Social / rivals
ALTER TABLE "Rival" ENABLE ROW LEVEL SECURITY;

-- ML profiles
ALTER TABLE "MlUserProfile" ENABLE ROW LEVEL SECURITY;

-- Seasonal events
ALTER TABLE "SeasonalEvent" ENABLE ROW LEVEL SECURITY;

-- Training data (privacy-sensitive anonymized snapshots)
ALTER TABLE IF EXISTS "TrainingDataSnapshot" ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too (belt-and-suspenders for non-superuser roles)
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Habit" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Completion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserStats" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ShopItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Inventory" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Achievement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserAchievement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BossBattle" FORCE ROW LEVEL SECURITY;
ALTER TABLE "QuestChain" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Rival" FORCE ROW LEVEL SECURITY;
ALTER TABLE "MlUserProfile" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SeasonalEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TrainingDataSnapshot" FORCE ROW LEVEL SECURITY;
