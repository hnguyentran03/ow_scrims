import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { count, eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/lib/db";
import { EVENT_TABLES, healing, kill, maps, playerStat, scrims } from "@/lib/db/schema";
import { DuplicateMapError, insertParsedMap } from "@/lib/db/insert-map";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";
import { EVENT_TYPES } from "@/lib/parser/events";

const sample = (name: string) => readFileSync(`test/samples/${name}.txt`, "utf8");

async function rowsIn(db: Db, table: typeof kill, mapId: number) {
  const [{ n }] = await db.select({ n: count() }).from(table).where(eq(table.mapId, mapId));
  return n;
}

describe("insertParsedMap", () => {
  let db: Db;
  let scrimId: number;

  beforeAll(async () => {
    db = await createTestDb();
    const [row] = await db.insert(scrims).values({ name: "vs Test", date: "2026-09-17", opponentName: "Test" }).returning({ id: scrims.id });
    scrimId = row.id;
  });

  it("inserts the map row with derived fields and every event row", async () => {
    const parsed = parseLog(sample("Log-2026-04-15-21-12-58"));
    const meta = deriveMapMeta(parsed);
    const mapId = await insertParsedMap(db, { scrimId, ourSide: 1, parsed, meta, originalFilename: "Log-2026-04-15-21-12-58.txt" });

    const [map] = await db.select().from(maps).where(eq(maps.id, mapId));
    expect(map).toMatchObject({ scrimId, order: 1, mapName: "Antarctic Peninsula", mapType: "Control", ourSide: 1, winnerSide: 1, winnerSource: "derived", team1Score: 3, team2Score: 0, roundCount: 3, rawLogPath: null });
    expect(map.durationSeconds).toBeCloseTo(661.03, 2);
    expect(await rowsIn(db, kill, mapId)).toBe(58);
    expect(await rowsIn(db, playerStat as unknown as typeof kill, mapId)).toBe(40);
  });

  it("rejects the same map uploaded twice to one scrim", async () => {
    const parsed = parseLog(sample("Log-2026-04-15-21-12-58"));
    const meta = deriveMapMeta(parsed);
    await expect(insertParsedMap(db, { scrimId, ourSide: 2, parsed, meta, originalFilename: "again.txt" })).rejects.toBeInstanceOf(DuplicateMapError);
    const [{ n }] = await db.select({ n: count() }).from(maps).where(eq(maps.scrimId, scrimId));
    expect(n).toBe(1);
  });

  it("inserts tens of thousands of rows in chunks and increments map order", async () => {
    const parsed = parseLog(sample("Log-2026-04-02-17-21-48"));
    const meta = deriveMapMeta(parsed);
    const mapId = await insertParsedMap(db, { scrimId, ourSide: 1, parsed, meta, originalFilename: "big.txt" });
    const [map] = await db.select({ order: maps.order, winnerSide: maps.winnerSide }).from(maps).where(eq(maps.id, mapId));
    expect(map).toEqual({ order: 2, winnerSide: 2 });
    expect(await rowsIn(db, healing as unknown as typeof kill, mapId)).toBe(11648);
  });

  it("stores Push maps with no winner", async () => {
    const parsed = parseLog(sample("Log-2024-01-10-20-38-42"));
    const meta = { ...deriveMapMeta(parsed), mapName: "Colosseo", mapType: "Push" as const, winnerSide: null };
    const mapId = await insertParsedMap(db, { scrimId, ourSide: 1, parsed, meta, originalFilename: "push.txt" });
    const [map] = await db.select({ winnerSide: maps.winnerSide, winnerSource: maps.winnerSource }).from(maps).where(eq(maps.id, mapId));
    expect(map).toEqual({ winnerSide: null, winnerSource: null });
  });

  it("inserts every event table's rows, including mercy_rez", async () => {
    const parsed = parseLog(sample("Log-2024-02-05-20-07-38"));
    const meta = deriveMapMeta(parsed);
    const mapId = await insertParsedMap(db, { scrimId, ourSide: 1, parsed, meta, originalFilename: "lny.txt" });

    expect(parsed.events.mercy_rez?.length ?? 0).toBeGreaterThan(0);

    for (const type of EVENT_TYPES) {
      const table = EVENT_TABLES[type] as unknown as typeof kill;
      expect(await rowsIn(db, table, mapId), type).toBe(parsed.events[type]?.length ?? 0);
    }
  });
});
