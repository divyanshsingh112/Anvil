-- SECURITY FIX: Add RLS policies for postgres, service_role, and authenticated roles
--
-- Restores access for Next.js server backend (postgres / service_role) while keeping
-- FORCE ROW LEVEL SECURITY enabled across all tables and restricting client PostgREST
-- queries to per-user auth.uid() boundaries.

-- 1. Service Role & Database Owner (postgres) Permissive Policies
CREATE POLICY "service_role_all_user" ON "User" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_habit" ON "Habit" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_completion" ON "Completion" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_userstats" ON "UserStats" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_shopitem" ON "ShopItem" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_inventory" ON "Inventory" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_achievement" ON "Achievement" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_userachievement" ON "UserAchievement" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_bossbattle" ON "BossBattle" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_questchain" ON "QuestChain" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_rival" ON "Rival" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_mluserprofile" ON "MlUserProfile" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_seasonalevent" ON "SeasonalEvent" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_trainingdatasnapshot" ON "TrainingDataSnapshot" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_habitautopsy" ON "HabitAutopsy" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);

-- 2. Per-User Authenticated Policies for Supabase REST Surface
CREATE POLICY "authenticated_user_policy" ON "User" FOR ALL TO authenticated USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "authenticated_habit_policy" ON "Habit" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "authenticated_completion_policy" ON "Completion" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "authenticated_userstats_policy" ON "UserStats" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "authenticated_inventory_policy" ON "Inventory" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "authenticated_userachievement_policy" ON "UserAchievement" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "authenticated_bossbattle_policy" ON "BossBattle" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "authenticated_questchain_policy" ON "QuestChain" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "authenticated_rival_policy" ON "Rival" FOR ALL TO authenticated USING (auth.uid()::text = "challengerId"::text OR auth.uid()::text = "rivalId"::text) WITH CHECK (auth.uid()::text = "challengerId"::text OR auth.uid()::text = "rivalId"::text);
CREATE POLICY "authenticated_mluserprofile_policy" ON "MlUserProfile" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "authenticated_habitautopsy_policy" ON "HabitAutopsy" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "authenticated_shopitem_select" ON "ShopItem" FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_achievement_select" ON "Achievement" FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_seasonalevent_select" ON "SeasonalEvent" FOR SELECT TO authenticated USING (true);
