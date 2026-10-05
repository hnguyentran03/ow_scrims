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

/** Problems found after applying: any real name still present in a name column, or a pseudonym that equals a real name. */
export async function verifyAnonymised(db: Db, map: AliasMap): Promise<string[]> {
  const problems: string[] = [];
  const reals = new Set(Object.keys(map.names));
  const pseudonyms = new Set(Object.values(map.names));
  for (const real of reals) if (pseudonyms.has(real)) problems.push(`pseudonym equals a real name: ${real}`);
  const { all } = await collectNames(db);
  for (const v of all) if (!pseudonyms.has(v)) problems.push(`not a pseudonym: ${v}`);
  return problems;
}

export async function clearRawLogPaths(db: Db): Promise<void> {
  await db.execute(sql`UPDATE map SET raw_log_path = NULL`);
}
