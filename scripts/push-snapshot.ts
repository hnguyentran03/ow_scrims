/**
 * Build and ship the public snapshot.
 *
 *   pnpm push-snapshot               copy data/db → anonymise → verify → dump → scp → restore on the box
 *   pnpm push-snapshot --dry-run     print what would change (new names, per-column counts); write nothing
 *   pnpm push-snapshot --local-only  stop after writing .snapshot/snapshot.sql.gz
 *   pnpm push-snapshot --allow-unknown   proceed even when a name column holds values that are not player_stat names or team names
 *
 * Never opens data/db itself: it refuses while the dev server holds it and works on a copy.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import type { Db } from "../src/lib/db";
import { extendAliasMap, type AliasMap } from "../src/lib/anonymise";
import { applyAliases, clearRawLogPaths, collectNames, verifyAnonymised } from "../src/lib/anonymise-db";

const ROOT = process.cwd();
const SOURCE = path.resolve(ROOT, process.env.OW_SOURCE_DB ?? path.join("data", "db"));
const SNAPSHOT_DIR = path.join(ROOT, ".snapshot");
const COPY = path.join(SNAPSHOT_DIR, "db");
const DUMP = path.join(SNAPSHOT_DIR, "snapshot.sql");
const DUMP_GZ = `${DUMP}.gz`;
const ALIAS_FILE = path.join(ROOT, "data", "alias-map.json");
const STATE_FILE = path.join(ROOT, ".push-state.json");
const SSH_HOST = process.env.OW_SSH_HOST ?? "ow-scrims";
const REMOTE_RESTORE = "/opt/ow-scrims/deploy/restore-template.sh";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const localOnly = args.has("--local-only");
const allowUnknown = args.has("--allow-unknown");

function fail(msg: string): never {
  console.error(`push-snapshot: ${msg}`);
  process.exit(1);
}

async function loadAliasMap(): Promise<AliasMap> {
  if (!existsSync(ALIAS_FILE)) return { names: {} };
  const parsed = JSON.parse(await readFile(ALIAS_FILE, "utf8")) as Partial<AliasMap>;
  return { names: parsed.names ?? {} };
}

function drizzleHash(): string {
  const out = execFileSync("bash", ["-c", "find drizzle -type f | sort | xargs shasum -a 256 | shasum -a 256"], { cwd: ROOT, encoding: "utf8" });
  return out.split(" ")[0] ?? "";
}

async function main() {
  if (existsSync(path.join(SOURCE, "postmaster.pid"))) fail(`stop the dev server first; ${SOURCE} is open by another process`);
  if (!existsSync(SOURCE)) fail(`${SOURCE} not found`);

  await rm(SNAPSHOT_DIR, { recursive: true, force: true });
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await cp(SOURCE, COPY, { recursive: true });
  await rm(path.join(COPY, "postmaster.pid"), { force: true });

  const pg = new PGlite(COPY);
  await pg.waitReady;
  const db = drizzle({ client: pg, schema }) as unknown as Db;

  const map = await loadAliasMap();
  const { all, players, teams } = await collectNames(db);

  // Anything in a player column that is neither a player_stat name nor a team name is probably a new sentinel.
  const statNames = new Set(((await db.execute(sql`SELECT DISTINCT player_name AS v FROM player_stat`)) as unknown as { rows: { v: string }[] }).rows.map((r) => r.v));
  const unknown = [...players].filter((p) => !statNames.has(p) && !teams.has(p));
  if (unknown.length) {
    console.warn(`values in player columns that are not player_stat names: ${unknown.map((u) => JSON.stringify(u)).join(", ")}`);
    if (!allowUnknown) fail("review the values above; add them to SENTINELS in src/lib/anonymise.ts or re-run with --allow-unknown");
  }
  const lowerSeen = new Map<string, string[]>();
  for (const n of all) lowerSeen.set(n.toLowerCase(), [...(lowerSeen.get(n.toLowerCase()) ?? []), n]);
  for (const variants of lowerSeen.values()) if (variants.length > 1) console.warn(`case variants of one name will get separate pseudonyms: ${variants.join(", ")}`);

  const { added } = extendAliasMap(map, all);
  console.log(`names: ${all.size} total, ${Object.keys(added).length} new`);
  for (const [real, p] of Object.entries(added)) console.log(`  ${real} -> ${p}`);

  if (dryRun) {
    console.log("dry run: nothing written");
    await pg.close();
    return;
  }

  await writeFile(ALIAS_FILE, JSON.stringify(map, null, 2) + "\n");
  const counts = await applyAliases(db, map);
  for (const [col, n] of Object.entries(counts)) if (n > 0) console.log(`  ${col}: ${n} rows`);
  const problems = await verifyAnonymised(db, map);
  if (problems.length) fail(`verification failed:\n  ${problems.join("\n  ")}`);
  await clearRawLogPaths(db);

  const dump = await pgDump({ pg, args: ["--no-owner", "--rows-per-insert=1000"] });
  await writeFile(DUMP, Buffer.from(await dump.arrayBuffer()));
  await pg.close();
  await pipeline(createReadStream(DUMP), createGzip(), createWriteStream(DUMP_GZ));
  console.log(`wrote ${DUMP_GZ}`);

  if (localOnly) return;

  execFileSync("scp", ["-q", DUMP_GZ, `${SSH_HOST}:/tmp/snapshot.sql.gz`], { stdio: "inherit" });
  execFileSync("ssh", [SSH_HOST, "sudo", "-u", "owscrims", "bash", REMOTE_RESTORE, "/tmp/snapshot.sql.gz"], { stdio: "inherit" });
  await writeFile(STATE_FILE, JSON.stringify({ pushedAt: new Date().toISOString(), drizzleHash: drizzleHash() }, null, 2) + "\n");
  console.log("snapshot live");
}

main().catch((err) => fail(String(err?.stack ?? err)));
