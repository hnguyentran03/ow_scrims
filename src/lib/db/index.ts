import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

async function createPglite(dataDir: string): Promise<Db> {
  if (dataDir !== "memory://") await mkdir(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as Db;
}

async function createPostgres(url: string): Promise<Db> {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const db = drizzle({ connection: url, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as Db;
}

function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return createPostgres(url);
  if (url === "memory://") return createPglite("memory://");
  return createPglite(path.join(process.cwd(), "data", "db"));
}

// Cached on globalThis so Next.js dev hot-reloads reuse one PGlite instance
// instead of opening the same data directory twice.
const g = globalThis as unknown as { __owScrimsDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__owScrimsDb ??= createDb();
  return g.__owScrimsDb;
}

/** A fresh in-memory PGlite database with migrations applied. For tests only. */
export function createTestDb(): Promise<Db> {
  return createPglite("memory://");
}
