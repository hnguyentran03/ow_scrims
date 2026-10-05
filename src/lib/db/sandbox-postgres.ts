import { rm } from "node:fs/promises";
import path from "node:path";
import { Pool, escapeIdentifier } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import type { Db } from "./index";
import { SANDBOX_DB_PREFIX, sandboxDbName } from "./sandbox-id";
import type { SandboxBackend, SandboxHandle } from "./sandbox-registry";

export interface PostgresSandboxConfig {
  /** Connection to the maintenance database (`postgres`); used only for CREATE/DROP DATABASE and pg_database. */
  adminUrl: string;
  templateDb: string;
  uploadRoot: string;
}

/** The admin URL with its database path swapped for `dbName`; host, auth, and query (socket dir) are kept. */
export function databaseUrl(adminUrl: string, dbName: string): string {
  const u = new URL(adminUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

/**
 * Two connections per sandbox: with SANDBOX_MAX at 20 that is 40, plus the public
 * copy's 4 and the admin pool's 1 — 45 against the box's max_connections of 50.
 */
const SANDBOX_POOL_MAX = 2;
const TEMPLATE_RETRY_MS = 1000;
const INVALID_CATALOG_NAME = "3D000";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `pg` reads `options` off the connection string's query and passes it to the backend. */
function readOnlyUrl(url: string): string {
  const u = new URL(url);
  u.searchParams.set("options", "-c default_transaction_read_only=on");
  return u.toString();
}

/** An idle-client error (a killed backend, a dropped database) must not reach the process as an uncaught 'error' event. */
function logPoolErrors(pool: Pool, dbName: string): Pool {
  pool.on("error", (err) => console.error("pg pool error", dbName, err));
  return pool;
}

export class PostgresSandboxBackend implements SandboxBackend {
  private readonly admin: Pool;

  constructor(private readonly cfg: PostgresSandboxConfig) {
    this.admin = logPoolErrors(new Pool({ connectionString: cfg.adminUrl, max: 1 }), "postgres");
  }

  /** Opens a pool to an existing database. `readOnly` forces every transaction on it read-only — the public copy's guard. */
  open(dbName: string, max = SANDBOX_POOL_MAX, opts: { readOnly?: boolean } = {}): SandboxHandle {
    const url = databaseUrl(this.cfg.adminUrl, dbName);
    const pool = logPoolErrors(new Pool({ connectionString: opts.readOnly ? readOnlyUrl(url) : url, max, idleTimeoutMillis: 30_000 }), dbName);
    const db = drizzle({ client: pool, schema }) as unknown as Db;
    return { db, close: () => pool.end() };
  }

  async create(id: string): Promise<SandboxHandle> {
    const name = sandboxDbName(id);
    const stmt = `CREATE DATABASE ${escapeIdentifier(name)} TEMPLATE ${escapeIdentifier(this.cfg.templateDb)} STRATEGY = FILE_COPY`;
    try {
      await this.admin.query(stmt);
    } catch (err) {
      // A push renames the template for an instant; one retry covers it.
      if ((err as { code?: string }).code !== INVALID_CATALOG_NAME) throw err;
      await sleep(TEMPLATE_RETRY_MS);
      await this.admin.query(stmt);
    }
    return this.open(name);
  }

  async destroy(id: string, handle: SandboxHandle | null): Promise<void> {
    if (handle) {
      // DROP DATABASE ... WITH (FORCE) below disconnects backends itself, so a failure
      // here must not stop the drop and the upload-directory cleanup that follow.
      try {
        await handle.close();
      } catch (err) {
        console.error("sandbox pool close failed", id, err);
      }
    }
    try {
      await this.dropDatabase(sandboxDbName(id));
    } finally {
      await rm(path.join(this.cfg.uploadRoot, id), { recursive: true, force: true });
    }
  }

  async listSandboxDatabases(): Promise<string[]> {
    const pattern = `${SANDBOX_DB_PREFIX.replaceAll("_", "\\_")}%`;
    const r = await this.admin.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE $1 ESCAPE '\\' ORDER BY datname",
      [pattern],
    );
    return r.rows.map((x) => x.datname).filter((name) => name.startsWith(SANDBOX_DB_PREFIX));
  }

  async dropDatabase(name: string): Promise<void> {
    await this.admin.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(name)} WITH (FORCE)`);
  }

  async end(): Promise<void> {
    await this.admin.end();
  }
}
