import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool, escapeIdentifier } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { scrims } from "@/lib/db/schema";
import { SandboxRegistry } from "@/lib/db/sandbox-registry";
import { PostgresSandboxBackend, databaseUrl } from "@/lib/db/sandbox-postgres";
import { newSandboxId, sandboxDbName } from "@/lib/db/sandbox-id";

const adminUrl = process.env.TEST_DATABASE_URL;
const suffix = Math.random().toString(16).slice(2, 10);
const templateDb = `ow_test_template_${suffix}`;
let admin: Pool;
let backend: PostgresSandboxBackend;
let uploadRoot: string;

describe.skipIf(!adminUrl)("sandboxes on Postgres", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: adminUrl, max: 1 });
    await admin.query(`CREATE DATABASE ${escapeIdentifier(templateDb)}`);
    const tpl = new Pool({ connectionString: databaseUrl(adminUrl!, templateDb), max: 1 });
    const tdb = drizzle({ client: tpl });
    await migrate(tdb, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    await tdb.insert(scrims).values({ name: "Seed", date: "2026-10-01", opponentName: "Seed opp" });
    await tpl.end(); // the template must have no connections when it is copied
    uploadRoot = mkdtempSync(path.join(tmpdir(), "ow-sb-"));
    backend = new PostgresSandboxBackend({ adminUrl: adminUrl!, templateDb, uploadRoot });
  });

  afterAll(async () => {
    for (const name of await backend.listSandboxDatabases()) await backend.dropDatabase(name);
    await backend.end();
    await admin.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(templateDb)} WITH (FORCE)`);
    await admin.end();
    rmSync(uploadRoot, { recursive: true, force: true });
  });

  it("clones the template per sandbox, isolates writes, and drops on reap", async () => {
    const registry = new SandboxRegistry(backend, { idleMs: 0, max: 5 });
    const a = newSandboxId(), b = newSandboxId();
    const dbA = await registry.create(a);
    const dbB = await registry.create(b);
    mkdirSync(path.join(uploadRoot, a), { recursive: true });

    await dbA.insert(scrims).values({ name: "Only in A", date: "2026-10-02", opponentName: "X" });
    expect((await dbA.select().from(scrims)).map((s) => s.name).sort()).toEqual(["Only in A", "Seed"]);
    expect((await dbB.select().from(scrims)).map((s) => s.name)).toEqual(["Seed"]);

    const names = await backend.listSandboxDatabases();
    expect(names).toContain(sandboxDbName(a));
    expect(names).toContain(sandboxDbName(b));

    expect((await registry.reapIdle()).sort()).toEqual([a, b].sort());
    expect(await backend.listSandboxDatabases()).toEqual([]);
    expect(existsSync(path.join(uploadRoot, a))).toBe(false);
  });

  it("opens a pool to an existing database without creating anything", async () => {
    const handle = backend.open(templateDb);
    expect((await handle.db.select().from(scrims)).map((s) => s.name)).toEqual(["Seed"]);
    await handle.close();
  });
});
