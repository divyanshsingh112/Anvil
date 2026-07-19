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

  console.log("Seeding complete!");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
