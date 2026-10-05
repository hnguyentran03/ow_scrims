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

const SANDBOX_POOL_MAX = 4;
const TEMPLATE_RETRY_MS = 1000;
const INVALID_CATALOG_NAME = "3D000";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class PostgresSandboxBackend implements SandboxBackend {
  private readonly admin: Pool;

  constructor(private readonly cfg: PostgresSandboxConfig) {
    this.admin = new Pool({ connectionString: cfg.adminUrl, max: 1 });
  }

  open(dbName: string, max = SANDBOX_POOL_MAX): SandboxHandle {
    const pool = new Pool({ connectionString: databaseUrl(this.cfg.adminUrl, dbName), max, idleTimeoutMillis: 30_000 });
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
    if (handle) await handle.close();
    await this.dropDatabase(sandboxDbName(id));
    await rm(path.join(this.cfg.uploadRoot, id), { recursive: true, force: true });
  }

  async listSandboxDatabases(): Promise<string[]> {
    const r = await this.admin.query<{ datname: string }>("SELECT datname FROM pg_database WHERE datname LIKE $1 ORDER BY datname", [`${SANDBOX_DB_PREFIX}%`]);
    return r.rows.map((x) => x.datname);
  }

  async dropDatabase(name: string): Promise<void> {
    await this.admin.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(name)} WITH (FORCE)`);
  }

  async end(): Promise<void> {
    await this.admin.end();
  }
}
