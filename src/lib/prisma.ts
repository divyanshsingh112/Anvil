import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDirect: PrismaClient | undefined;
};

// 1. Default pooled client (PgBouncer port 6543 / transaction pooling) for standard queries
const createPrismaClient = () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });
};

// 2. Dedicated direct client (Port 5432 / session connection) for interactive $transaction calls
const createPrismaDirectClient = () => {
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const pool = new pg.Pool({
    connectionString: directUrl,
    max: 1, // Restrict per-lambda direct pool size to prevent connection exhaustion
    idleTimeoutMillis: 5000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
export const prismaDirect = globalForPrisma.prismaDirect ?? createPrismaDirectClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDirect = prismaDirect;
}

