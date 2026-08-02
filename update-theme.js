const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

async function main() {
  const theme = process.argv[2] || 'Racing';
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const pass = await bcrypt.hash('Password123!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'themetest@example.com' },
    update: { password: pass, activeTheme: theme },
    create: { email: 'themetest@example.com', displayName: 'ThemeTester', password: pass, activeTheme: theme }
  });

  console.log(`User ${user.email} updated activeTheme to: ${user.activeTheme}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
