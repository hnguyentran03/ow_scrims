import { and, count, eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { EVENT_TABLES, maps, playerStat } from "./schema";
import { EVENT_TYPES } from "@/lib/parser/events";
import type { ParsedLog } from "@/lib/parser/parse";
import type { MapMeta, Side } from "@/lib/parser/derive";

export const INSERT_CHUNK = 500;

export class DuplicateMapError extends Error {
  constructor() {
    super("this map is already uploaded to this scrim");
    this.name = "DuplicateMapError";
  }
}

export interface InsertMapInput {
  scrimId: number;
  ourSide: Side;
  parsed: ParsedLog;
  meta: MapMeta;
  originalFilename: string;
}

function playerNames(parsed: ParsedLog): Set<string> {
  return new Set((parsed.events.player_stat ?? []).map((r) => String(r.playerName)));
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/**
 * Inserts the map row and every event row in one transaction.
 * Throws DuplicateMapError if the scrim already has a map with the same name,
 * duration, and set of player names.
 */
export async function insertParsedMap(db: Db, input: InsertMapInput): Promise<number> {
  const { scrimId, ourSide, parsed, meta, originalFilename } = input;

  return db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: maps.id })
      .from(maps)
      .where(and(eq(maps.scrimId, scrimId), eq(maps.mapName, meta.mapName), sql`abs(${maps.durationSeconds} - ${meta.durationSeconds}) < 0.01`));
    const incoming = playerNames(parsed);
    for (const c of candidates) {
      const rows = await tx.selectDistinct({ name: playerStat.playerName }).from(playerStat).where(eq(playerStat.mapId, c.id));
      if (sameSet(incoming, new Set(rows.map((r) => r.name)))) throw new DuplicateMapError();
    }

    const [{ n: existing }] = await tx.select({ n: count() }).from(maps).where(eq(maps.scrimId, scrimId));

    const [inserted] = await tx
      .insert(maps)
      .values({
        scrimId,
        order: existing + 1,
        mapName: meta.mapName,
        mapType: meta.mapType,
        team1Name: meta.team1Name,
        team2Name: meta.team2Name,
        ourSide,
        winnerSide: meta.winnerSide,
        winnerSource: meta.winnerSide === null ? null : "derived",
        team1Score: meta.team1Score,
        team2Score: meta.team2Score,
        durationSeconds: meta.durationSeconds,
        roundCount: meta.roundCount,
        originalFilename,
      })
      .returning({ id: maps.id });
    const mapId = inserted.id;

    for (const type of EVENT_TYPES) {
      const rows = parsed.events[type];
      if (!rows || rows.length === 0) continue;
      const table = EVENT_TABLES[type];
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const chunk = rows.slice(i, i + INSERT_CHUNK).map((r) => ({ ...r, mapId }));
        // Rows are validated against the same descriptors the schema was built from (Task 8 test),
        // so the generic record shape is safe to hand to the typed insert.
        await tx.insert(table).values(chunk as never);
      }
    }

    return mapId;
  });
}
