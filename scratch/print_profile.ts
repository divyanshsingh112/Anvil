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

  console.log("=== QUERYING ML_USER_PROFILE ROW ===");
  
  // Let's create a temporary user with some statistics, run the API endpoint logic, 
  // and print the resulting row from the database in full JSON before cleaning up.
  const uniqueId = Date.now().toString().slice(-6);
  const user = await prisma.user.create({
    data: {
      email: `print_profile_${uniqueId}@example.com`,
      displayName: `Print Profile User ${uniqueId}`,
      xp: 0,
      level: 1,
      coins: 0,
    },
  });

  const habit = await prisma.habit.create({
    data: {
      userId: user.id,
      name: "Verification Gym",
      class: "warrior",
      difficulty: "novice",
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    },
  });

  // Create 12 completions at 11 PM
  const records = [];
  for (let i = 0; i < 12; i++) {
    const cDate = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
    cDate.setUTCHours(0, 0, 0, 0);
    const compDate = new Date(cDate.getTime());
    compDate.setUTCHours(23, 0, 0, 0); // 11 PM

    records.push({
      habitId: habit.id,
      userId: user.id,
      date: cDate,
      loggedAt: new Date(),
      completedAt: compDate,
      timeBucket: "evening",
      timeAccuracy: "confirmed",
    });
  }
  await prisma.completion.createMany({ data: records });

  // Run the calculator
  const { calculateProcrastinationFingerprint } = await import("../src/lib/procrastination-calculator");
  const results = await calculateProcrastinationFingerprint(user.id);
  const { dangerZoneHours, lastMinuteRate, avoidancePattern } = results;

  // Insert into MlUserProfile
  const dbDangerZone = dangerZoneHours === "insufficient_data" ? [] : dangerZoneHours;
  const dbLastMinute = lastMinuteRate === "insufficient_data" ? null : lastMinuteRate;
  const dbAvoidance = avoidancePattern as any;

  const profile = await prisma.mlUserProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      dangerZoneHours: dbDangerZone,
      lastMinuteRate: dbLastMinute,
      procrastinationScore: dbLastMinute,
      avoidancePattern: dbAvoidance,
      lastComputedAt: new Date(),
    },
    update: {
      dangerZoneHours: dbDangerZone,
      lastMinuteRate: dbLastMinute,
      procrastinationScore: dbLastMinute,
      avoidancePattern: dbAvoidance,
      lastComputedAt: new Date(),
    },
  });

  console.log("\nDATABASE ROW (MlUserProfile) for test user:");
  console.log(JSON.stringify(profile, null, 2));

  // Clean up
  await prisma.habit.deleteMany({ where: { userId: user.id } });
  await prisma.mlUserProfile.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("\nDone!");
}

run()
  .catch(console.error)
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
