-- Enable and Force Row Level Security on NextAuth tables
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;

ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" FORCE ROW LEVEL SECURITY;

-- Service Role & Postgres Permissive Policies
CREATE POLICY "service_role_all_account" ON "Account" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_session" ON "Session" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_verification_token" ON "VerificationToken" FOR ALL TO postgres, service_role USING (true) WITH CHECK (true);

-- User-scoped Policies for Account and Session
CREATE POLICY "user_all_account" ON "Account" FOR ALL TO authenticated USING ((SELECT auth.uid()) = "userId") WITH CHECK ((SELECT auth.uid()) = "userId");
CREATE POLICY "user_all_session" ON "Session" FOR ALL TO authenticated USING ((SELECT auth.uid()) = "userId") WITH CHECK ((SELECT auth.uid()) = "userId");
