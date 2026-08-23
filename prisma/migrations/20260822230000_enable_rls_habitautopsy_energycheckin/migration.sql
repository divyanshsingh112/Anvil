-- SECURITY FIX: Enable and Force Row Level Security on HabitAutopsy and EnergyCheckin
--
-- 1. HabitAutopsy RLS & Policies
ALTER TABLE "HabitAutopsy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HabitAutopsy" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'HabitAutopsy' AND policyname = 'service_role_all_habitautopsy'
  ) THEN
    CREATE POLICY "service_role_all_habitautopsy" ON "HabitAutopsy" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'HabitAutopsy' AND policyname = 'authenticated_habitautopsy_policy'
  ) THEN
    CREATE POLICY "authenticated_habitautopsy_policy" ON "HabitAutopsy" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
  END IF;
END $$;

-- 2. EnergyCheckin RLS & Policies
ALTER TABLE "EnergyCheckin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnergyCheckin" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'EnergyCheckin' AND policyname = 'service_role_all_energycheckin'
  ) THEN
    CREATE POLICY "service_role_all_energycheckin" ON "EnergyCheckin" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'EnergyCheckin' AND policyname = 'authenticated_energycheckin_policy'
  ) THEN
    CREATE POLICY "authenticated_energycheckin_policy" ON "EnergyCheckin" FOR ALL TO authenticated USING (auth.uid()::text = "userId"::text) WITH CHECK (auth.uid()::text = "userId"::text);
  END IF;
END $$;
