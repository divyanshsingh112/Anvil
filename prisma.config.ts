import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local for Prisma CLI (Next.js handles this at runtime)
config({ path: path.join(__dirname, ".env.local") });

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DIRECT_URL!,
  },
});
