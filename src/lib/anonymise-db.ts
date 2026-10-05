/**
 * The database sweep that applies anonymise.ts's alias map. Driven by scripts/push-snapshot.ts.
 */
import { sql } from "drizzle-orm";
import type { Db } from "./db";
import { PLAYER_COLUMNS, TEAM_COLUMNS, isSkipped, rewriteScrimName, type AliasMap, type Column } from "./anonymise";

const ident = (name: string) => sql.identifier(name);

async function execRows<T>(db: Db, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = (await db.execute(query)) as unknown as { rows: T[] };
  return result.rows;
}

async function distinctValues(db: Db, c: Column): Promise<string[]> {
  const rows = await execRows<{ v: string }>(
    db,
    sql`SELECT DISTINCT ${ident(c.column)} AS v FROM ${ident(c.table)} WHERE ${ident(c.column)} IS NOT NULL`,
  );
  return rows.map((r) => r.v);
}

/** Every distinct non-skipped value in the player and team columns. `all` is their union. */
export async function collectNames(db: Db): Promise<{ all: Set<string>; players: Set<string>; teams: Set<string> }> {
  const players = new Set<string>();
  const teams = new Set<string>();
  for (const c of PLAYER_COLUMNS) for (const v of await distinctValues(db, c)) if (!isSkipped(v)) players.add(v);
  for (const c of TEAM_COLUMNS) for (const v of await distinctValues(db, c)) if (!isSkipped(v)) teams.add(v);
  return { all: new Set([...players, ...teams]), players, teams };
}

async function loadAliasTable(db: Db, map: AliasMap): Promise<void> {
  await db.execute(sql`CREATE TEMP TABLE IF NOT EXISTS alias (real text PRIMARY KEY, pseudonym text NOT NULL)`);
  await db.execute(sql`DELETE FROM alias`);
  for (const [real, pseudonym] of Object.entries(map.names)) {
    await db.execute(sql`INSERT INTO alias (real, pseudonym) VALUES (${real}, ${pseudonym})`);
  }
}

/**
 * Rows-changed count across drivers: PGlite's result carries `affectedRows`,
 * node-postgres's carries `rowCount`; both were observed as `{ rows, affectedRows,
 * rowCount }` against the PGlite driver used here, so reading either is safe.
 */
function affected(result: unknown): number {
  const r = result as { affectedRows?: number; rowCount?: number };
  return r.affectedRows ?? r.rowCount ?? 0;
}

/** Rewrites every player and team column through the alias table and the scrim names in TypeScript. Returns rows changed per column. */
export async function applyAliases(db: Db, map: AliasMap): Promise<Record<string, number>> {
  await loadAliasTable(db, map);
  const counts: Record<string, number> = {};
  for (const c of [...PLAYER_COLUMNS, ...TEAM_COLUMNS]) {
    const res = await db.execute(
      sql`UPDATE ${ident(c.table)} t SET ${ident(c.column)} = a.pseudonym FROM alias a WHERE t.${ident(c.column)} = a.real`,
    );
    counts[`${c.table}.${c.column}`] = affected(res);
  }
  const scrimRows = await execRows<{ id: number; name: string }>(db, sql`SELECT id, name FROM scrim`);
  let changed = 0;
  for (const row of scrimRows) {
    const next = rewriteScrimName(row.name, map);
    if (next !== row.name) {
      await db.execute(sql`UPDATE scrim SET name = ${next} WHERE id = ${row.id}`);
      changed++;
    }
  }
  counts["scrim.name"] = changed;
  return counts;
}

/**
 * Rows each column would rewrite, without writing anything. For --dry-run: the alias table
 * is a temp table, so this leaves the database it reads untouched.
 */
export async function countAliasMatches(db: Db, map: AliasMap): Promise<Record<string, number>> {
  await loadAliasTable(db, map);
  const counts: Record<string, number> = {};
  for (const c of [...PLAYER_COLUMNS, ...TEAM_COLUMNS]) {
    const [row] = await execRows<{ n: number | string }>(
      db,
      sql`SELECT count(*) AS n FROM ${ident(c.table)} t JOIN alias a ON t.${ident(c.column)} = a.real`,
    );
    counts[`${c.table}.${c.column}`] = Number(row?.n ?? 0);
  }
  return counts;
}

/**
 * Shorter real names match inside ordinary words ("Ro" in "Rocket"), so the free-text scan
 * below only looks for names of at least this length.
 */
const MIN_SCANNED_NAME = 3;

/** The free-text columns no alias column covers: a hand-typed scrim name and the uploaded file's name. */
const SCANNED_TEXT: { label: string; query: ReturnType<typeof sql> }[] = [
  { label: "scrim.name", query: sql`SELECT name AS v FROM scrim WHERE name IS NOT NULL` },
  { label: "map.original_filename", query: sql`SELECT original_filename AS v FROM map WHERE original_filename IS NOT NULL` },
];

/**
 * Problems found after applying: any real name still present in a name column, a pseudonym
 * that equals a real name, or a real name surviving as a substring of a scrim name or an
 * uploaded filename — neither of which the column sweep rewrites value-for-value.
 */
export async function verifyAnonymised(db: Db, map: AliasMap): Promise<string[]> {
  const problems: string[] = [];
  const reals = new Set(Object.keys(map.names));
  const pseudonyms = new Set(Object.values(map.names));
  for (const real of reals) if (pseudonyms.has(real)) problems.push(`pseudonym equals a real name: ${real}`);
  const { all } = await collectNames(db);
  for (const v of all) if (!pseudonyms.has(v)) problems.push(`not a pseudonym: ${v}`);

  const needles = [...reals].filter((r) => r.length >= MIN_SCANNED_NAME).map((r) => [r, r.toLowerCase()] as const);
  if (needles.length > 0) {
    for (const { label, query } of SCANNED_TEXT) {
      const seen = new Map<string, string>();
      for (const { v } of await execRows<{ v: string }>(db, query)) {
        const lower = v.toLowerCase();
        for (const [real, needle] of needles) if (lower.includes(needle) && !seen.has(real)) seen.set(real, v);
      }
      for (const [real, v] of seen) problems.push(`real name in ${label}: ${real} (${JSON.stringify(v)})`);
    }
  }
  return problems;
}

/**
 * Blanks the upload trail before the dump: the raw-log path, whose file never ships, and
 * the original filename, which ScrimTime names after the teams that played. The column is
 * NOT NULL, so it gets a constant rather than NULL.
 */
export async function clearUploadMetadata(db: Db): Promise<void> {
  await db.execute(sql`UPDATE map SET raw_log_path = NULL, original_filename = 'log.txt'`);
}
