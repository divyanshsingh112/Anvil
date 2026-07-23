import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAnonId } = await import("../src/lib/services/training-export-service");

  console.log("=== STARTING LOUD-FAILURE VERIFICATION ===\n");

  // 1. Check env is set initially
  console.log(`Initial ANON_SYSTEM_SECRET exists: ${!!process.env.ANON_SYSTEM_SECRET}`);

  // 2. Temporarily delete the env var to trigger failure
  const originalSecret = process.env.ANON_SYSTEM_SECRET;
  delete process.env.ANON_SYSTEM_SECRET;
  console.log(`ANON_SYSTEM_SECRET deleted: ${!process.env.ANON_SYSTEM_SECRET}`);

  console.log("\nAttempting to call getAnonId without secret...");
  try {
    getAnonId("test-user-id");
    console.log("FAILED: Expected getAnonId to throw an error, but it succeeded.");
  } catch (e: any) {
    console.log("SUCCESS: getAnonId threw as expected!");
    console.log("Actual Error Message:");
    console.log(e.message);
  }

  // 3. Restore the env var and confirm it succeeds
  process.env.ANON_SYSTEM_SECRET = originalSecret;
  console.log(`\nANON_SYSTEM_SECRET restored: ${!!process.env.ANON_SYSTEM_SECRET}`);
  
  console.log("Attempting to call getAnonId with secret restored...");
  try {
    const anonId = getAnonId("test-user-id");
    console.log("SUCCESS: getAnonId succeeded!");
    console.log(`Resulting anonId: ${anonId} (Length: ${anonId.length})`);
  } catch (e: any) {
    console.log("FAILED: Expected getAnonId to succeed, but it threw an error:", e.message);
  }
}

run().catch(console.error);
