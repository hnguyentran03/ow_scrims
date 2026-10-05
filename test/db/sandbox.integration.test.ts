import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

/** Every id this file created, so the cleanup drops only its own databases and leaves a concurrent run's alone. */
const created: string[] = [];
function trackedId(): string {
  const id = newSandboxId();
  created.push(id);
  return id;
}

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
    try {
      for (const id of created) await backend.dropDatabase(sandboxDbName(id));
      await backend.end();
    } finally {
      try {
        await admin.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(templateDb)} WITH (FORCE)`);
      } finally {
        await admin.end();
        rmSync(uploadRoot, { recursive: true, force: true });
      }
    }
  });

  it("clones the template per sandbox, isolates writes, and drops on reap", async () => {
    const registry = new SandboxRegistry(backend, { idleMs: 0, max: 5 });
    const a = trackedId(), b = trackedId();
    const dbA = await registry.create(a);
    const dbB = await registry.create(b);
    mkdirSync(path.join(uploadRoot, a), { recursive: true });
    mkdirSync(path.join(uploadRoot, b), { recursive: true });

    await dbA.insert(scrims).values({ name: "Only in A", date: "2026-10-02", opponentName: "X" });
    expect((await dbA.select().from(scrims)).map((s) => s.name).sort()).toEqual(["Only in A", "Seed"]);
    expect((await dbB.select().from(scrims)).map((s) => s.name)).toEqual(["Seed"]);

    const names = await backend.listSandboxDatabases();
    expect(names).toContain(sandboxDbName(a));
    expect(names).toContain(sandboxDbName(b));

    expect((await registry.reapIdle()).sort()).toEqual([a, b].sort());
    for (const id of [a, b]) expect(await backend.listSandboxDatabases()).not.toContain(sandboxDbName(id));
    expect(existsSync(path.join(uploadRoot, a))).toBe(false);
    expect(existsSync(path.join(uploadRoot, b))).toBe(false);
  });

  it("opens a pool to an existing database without creating anything", async () => {
    const handle = backend.open(templateDb);
    expect((await handle.db.select().from(scrims)).map((s) => s.name)).toEqual(["Seed"]);
    await handle.close();
  });

  it("refuses a write through a read-only handle, which is how the public copy is opened", async () => {
    const handle = backend.open(templateDb, 1, { readOnly: true });
    try {
      // Drizzle wraps driver errors in "Failed query: …", so the refusal is in the cause.
      const err = await handle.db.insert(scrims).values({ name: "nope", date: "2026-10-03", opponentName: "X" }).then(
        () => null,
        (e: unknown) => e as Error & { cause?: Error },
      );
      expect(err).not.toBeNull();
      expect(`${err!.message} ${err!.cause?.message ?? ""}`).toMatch(/read-only/i);
      expect((await handle.db.select().from(scrims)).map((s) => s.name)).toEqual(["Seed"]);
    } finally {
      await handle.close();
    }
  });

  it("still drops the database and upload directory when the handle's close rejects", async () => {
    const id = trackedId();
    const real = await backend.create(id);
    const wrapped = {
      db: real.db,
      close: async () => {
        await real.close();
        throw new Error("close failed");
      },
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(backend.destroy(id, wrapped)).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith("sandbox pool close failed", id, expect.any(Error));
      expect(await backend.listSandboxDatabases()).not.toContain(sandboxDbName(id));
    } finally {
      spy.mockRestore();
    }
  });
});
