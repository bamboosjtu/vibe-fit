import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

export const prisma = new PrismaClient();

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export async function getDatabaseSchemaVersion(): Promise<string> {
  if (env.DATA_MODE !== "postgres") return env.DATABASE_SCHEMA_VERSION;

  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM schema_migrations
  `;
  return String(rows[0]?.count ?? 0n);
}
