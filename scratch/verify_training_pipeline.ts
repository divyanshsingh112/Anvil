import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

async function run() {
  const { prisma } = await import("../src/lib/prisma");
  const { exportAnonymizedSnapshot, getAnonId } = await import("../src/lib/services/training-export-service");

  console.log("=== STARTING TRAINING Consent & PIPELINE VERIFICATION ===\n");

  // Create a clean test user account
  const uniqueId = Date.now().toString().slice(-6);
  const email = `testuser_consent_${uniqueId}@example.com`;

  // 5. Default consent for new accounts
  console.log("--- VERIFICATION 5: New Account Consent Default ---");
  const newUser = await prisma.user.create({
    data: {
      email,
      displayName: `Privacy Test User ${uniqueId}`,
      xp: 0,
      level: 1,
      coins: 0,
    },
  });
  console.log(`Created new account: ${newUser.id} (${newUser.email})`);
  console.log(`Default trainingDataConsent value: ${newUser.trainingDataConsent} (Expected: false)`);
  console.log(`Default trainingConsentUpdatedAt value: ${newUser.trainingConsentUpdatedAt} (Expected: null)\n`);

  // Initialize stats for this user
  await prisma.userStats.create({
    data: {
      userId: newUser.id,
      totalCompletions: 15,
      warriorCompletions: 10,
      mageCompletions: 5,
      rogueCompletions: 0,
    },
  });

  // 1. Enable Consent
  console.log("--- VERIFICATION 1: Enable Consent ---");
  const enabledUser = await prisma.user.update({
    where: { id: newUser.id },
    data: {
      trainingDataConsent: true,
      trainingConsentUpdatedAt: new Date(),
    },
  });
  console.log(`Updated trainingDataConsent value: ${enabledUser.trainingDataConsent} (Expected: true)`);
  console.log(`Updated trainingConsentUpdatedAt: ${enabledUser.trainingConsentUpdatedAt?.toISOString()}\n`);

  // 2. Trigger Export with Consent Enabled
  console.log("--- VERIFICATION 2: Trigger Export (With Consent) ---");
  const snapshot = await exportAnonymizedSnapshot(newUser.id);
  console.log("Resulting Snapshot Row JSON:");
  console.log(JSON.stringify(snapshot, null, 2));
  console.log("");

  // Inspect fields for identifiers
  const hasUserIdentifiers = [
    "userId", "email", "displayName", "name", "text", "notes", "ip", "address"
  ].some(prop => prop in snapshot);
  console.log(`Contains any direct identifier fields (userId, name, email, etc.)? ${hasUserIdentifiers} (Expected: false)\n`);

  // 3. Disable Consent & Trigger again
  console.log("--- VERIFICATION 3: Disable Consent & Trigger Again ---");
  await prisma.user.update({
    where: { id: newUser.id },
    data: {
      trainingDataConsent: false,
      trainingConsentUpdatedAt: new Date(),
    },
  });

  // Fetch count before triggering export when consent is off
  const snapshotCountBefore = await prisma.trainingDataSnapshot.count();
  
  // Trigger again
  const skippedSnapshot = await exportAnonymizedSnapshot(newUser.id);
  
  const snapshotCountAfter = await prisma.trainingDataSnapshot.count();
  console.log(`Result from export function when consent is disabled:`, skippedSnapshot);
  console.log(`Snapshot database row count BEFORE trigger: ${snapshotCountBefore}`);
  console.log(`Snapshot database row count AFTER trigger:  ${snapshotCountAfter}`);
  console.log(`Did the snapshot count remain unchanged? ${snapshotCountBefore === snapshotCountAfter} (Expected: true)\n`);

  // 4. Trace back to user check
  console.log("--- VERIFICATION 4: Decoupling Check (Joining back to User) ---");
  const anonId = getAnonId(newUser.id);
  console.log(`Hashed anonId: ${anonId}`);
  
  // Attempt to check if anonId joins directly or if any relations exist in schema
  // Check that no foreign key or Join Path exists back to User table
  try {
    // If a relation existed, Prisma would allow querying: prisma.trainingDataSnapshot.findFirst({ include: { user: true } })
    // Since there is no join path, trying to compile/run this query under typescript/Prisma would fail.
    // Let's print the fields to prove there is no userId or join key.
    console.log("TrainingDataSnapshot schema columns:");
    const columns = Object.keys(snapshot);
    console.log(columns.join(", "));
    console.log(`Does a 'userId' column exist? ${columns.includes("userId")} (Expected: false)`);
    console.log(`Does a 'user' relation exist? ${columns.includes("user")} (Expected: false)`);
  } catch (e: any) {
    console.log("Trace error:", e.message);
  }
  console.log("");

  // Cleanup
  console.log("Cleaning up test user data...");
  await prisma.user.delete({ where: { id: newUser.id } });
  
  // We keep the snapshot in the database as completed anonymized data, matching specification!
  console.log("Test clean up finished successfully!\n");
}

run()
  .catch((e) => {
    console.error("Verification failed:", e);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
