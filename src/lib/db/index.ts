import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { isSandboxId, newSandboxId, SANDBOX_COOKIE } from "./sandbox-id";
// ./sandbox pulls in `pg`; it is imported dynamically below so PGlite-only local dev
// and the unit tests never load the Postgres driver. Only the env check is static.
import { sandboxMode } from "./sandbox-env";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

async function createPglite(dataDir: string): Promise<Db> {
  if (dataDir !== "memory://") await mkdir(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

async function createPostgres(url: string): Promise<Db> {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const db = drizzle({ connection: url, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
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

function singleDb(): Promise<Db> {
  g.__owScrimsDb ??= createDb();
  return g.__owScrimsDb;
}

/** The request's sandbox id from the cookie, or null when absent or malformed. */
export async function requestSandboxId(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const v = (await cookies()).get(SANDBOX_COOKIE)?.value;
  return isSandboxId(v) ? v : null;
}

/**
 * The database for reads. Outside sandbox mode, the one configured database.
 * In sandbox mode, the visitor's live sandbox when they have one, else the shared
 * public copy. Never creates a sandbox, so crawlers and lookers cost nothing.
 */
export async function getDb(): Promise<Db> {
  if (!sandboxMode()) return singleDb();
  const { liveSandboxDb, publicDb } = await import("./sandbox");
  const id = await requestSandboxId();
  if (id) {
    const db = await liveSandboxDb(id);
    if (db) return db;
  }
  return publicDb();
}

/**
 * The database for writes, creating the visitor's sandbox and setting its cookie
 * when they have none. Only callable where cookies may be set: server actions and
 * route handlers.
 */
export async function getWritableSandbox(): Promise<{ db: Db; sandboxId: string | null }> {
  if (!sandboxMode()) return { db: await singleDb(), sandboxId: null };
  const { createSandbox, liveSandboxDb } = await import("./sandbox");
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const current = store.get(SANDBOX_COOKIE)?.value;
  if (isSandboxId(current)) {
    const db = await liveSandboxDb(current);
    if (db) return { db, sandboxId: current };
  }
  const id = newSandboxId();
  const db = await createSandbox(id);
  store.set(SANDBOX_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return { db, sandboxId: id };
}

export async function getWritableDb(): Promise<Db> {
  return (await getWritableSandbox()).db;
}

/** A fresh in-memory PGlite database with migrations applied. For tests only. */
export function createTestDb(): Promise<Db> {
  return createPglite("memory://");
}
