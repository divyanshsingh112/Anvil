const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

async function main() {
  console.log("Starting seeding of Anvil shop items...");
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();

  const items = [
    {
      name: "Midnight Mode",
      type: "theme",
      priceCoins: 50,
      description: "A dark mode theme for midnight coders.",
      cssVariables: {
        "--bg-primary": "#020617",
        "--bg-secondary": "#0f172a",
        "--bg-tertiary": "#1e293b",
        "--border": "#334155",
        "--accent-purple": "#8b5cf6",
        "--accent-teal": "#14b8a6",
        "--accent-gold": "#f59e0b",
        "--text-primary": "#f8fafc",
        "--text-secondary": "#cbd5e1",
        "--text-muted": "#64748b",
        "--heat-0": "#0f172a",
        "--heat-1": "#5b21b6",
        "--heat-2": "#7c3aed",
        "--heat-3": "#a855f7"
      },
      isLimited: false
    },
    {
      name: "Forest Cloak",
      type: "theme",
      priceCoins: 150,
      description: "An earthy theme inspired by ancient forests.",
      cssVariables: {
        "--bg-primary": "#052e16",
        "--bg-secondary": "#064e3b",
        "--bg-tertiary": "#14532d",
        "--border": "#15803d",
        "--accent-purple": "#84cc16",
        "--accent-teal": "#10b981",
        "--accent-gold": "#eab308",
        "--text-primary": "#f0fdf4",
        "--text-secondary": "#86efac",
        "--text-muted": "#3f6212",
        "--heat-0": "#064e3b",
        "--heat-1": "#166534",
        "--heat-2": "#15803d",
        "--heat-3": "#22c55e"
      },
      isLimited: false
    },
    {
      name: "Cyberpunk",
      type: "theme",
      priceCoins: 300,
      description: "Neon lights and high contrast digital aesthetics.",
      cssVariables: {
        "--bg-primary": "#09090b",
        "--bg-secondary": "#18181b",
        "--bg-tertiary": "#27272a",
        "--border": "#ff007f",
        "--accent-purple": "#ff007f",
        "--accent-teal": "#00f0ff",
        "--accent-gold": "#ffff00",
        "--text-primary": "#ffffff",
        "--text-secondary": "#00f0ff",
        "--text-muted": "#71717a",
        "--heat-0": "#18181b",
        "--heat-1": "#4a004a",
        "--heat-2": "#9b009b",
        "--heat-3": "#ff00ff"
      },
      isLimited: false
    },
    {
      name: "Streak Freeze",
      type: "consumable",
      priceCoins: 100,
      description: "Keeps your habit streak intact if you miss a day.",
      cssVariables: null,
      isLimited: false
    }
  ];

  for (const item of items) {
    const existing = await prisma.shopItem.findFirst({
      where: { name: item.name }
    });

    if (existing) {
      await prisma.shopItem.update({
        where: { id: existing.id },
        data: item
      });
      console.log(`Updated shop item: ${item.name}`);
    } else {
      const created = await prisma.shopItem.create({
        data: item
      });
      console.log(`Created shop item: ${item.name} with ID: ${created.id}`);
    }
  }

  const achievements = [
    { key: "streak_3", name: "3-Day Streak", description: "Maintain a quest streak of 3 consecutive days.", xpReward: 20, icon: "Flame" },
    { key: "streak_7", name: "7-Day Streak", description: "Maintain a quest streak of 7 consecutive days.", xpReward: 50, icon: "Trophy" },
    { key: "streak_30", name: "30-Day Streak", description: "Maintain a quest streak of 30 consecutive days.", xpReward: 150, icon: "Shield" },
    { key: "first_levelup", name: "First Level Up", description: "Ascend to Level 2.", xpReward: 25, icon: "Sparkles" },
    { key: "level_10", name: "Level 10", description: "Ascend to Level 10.", xpReward: 100, icon: "Crown" },
    { key: "level_25", name: "Level 25", description: "Ascend to Level 25.", xpReward: 250, icon: "Swords" },
    { key: "perfect_week", name: "Perfect Week", description: "Complete all daily active quests for 7 consecutive days.", xpReward: 100, icon: "CalendarCheck" },
    { key: "chain_master", name: "Chain Master", description: "Complete any quest chain 10 times.", xpReward: 100, icon: "Link" },
    { key: "rival_winner", name: "Rival Winner", description: "Defeat your first rival in a duel.", xpReward: 50, icon: "Award" },
    { key: "rival_dominator", name: "Rival Dominator", description: "Defeat rivals in 5 duels.", xpReward: 200, icon: "Trophy" },
    { key: "iron_mage", name: "Iron Mage", description: "Log 100 completed Mage-class quests.", xpReward: 100, icon: "Sparkles" },
    { key: "iron_warrior", name: "Iron Warrior", description: "Log 100 completed Warrior-class quests.", xpReward: 100, icon: "Sword" },
    { key: "iron_rogue", name: "Iron Rogue", description: "Log 100 completed Rogue-class quests.", xpReward: 100, icon: "Zap" },
    { key: "momentum_100", name: "Perfect Momentum", description: "Maintain a perfect momentum score of 100.", xpReward: 50, icon: "Flame" },
    { key: "comeback_kid", name: "Comeback Kid", description: "Recover momentum score from below 20 back above 60.", xpReward: 75, icon: "ShieldAlert" }
  ];

  for (const ach of achievements) {
    const existing = await prisma.achievement.findUnique({
      where: { key: ach.key }
    });

    if (existing) {
      await prisma.achievement.update({
        where: { key: ach.key },
        data: ach
      });
      console.log(`Updated achievement: ${ach.key}`);
    } else {
      const created = await prisma.achievement.create({
        data: ach
      });
      console.log(`Created achievement: ${ach.key} with ID: ${created.id}`);
    }
  }

  console.log("Seeding complete!");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
