import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim, deleteMap, deleteScrim, getMap, getMapStats, getScrim, listScrims, setMapWinner } from "@/lib/db/queries";
import { insertParsedMap } from "@/lib/db/insert-map";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

const sample = (name: string) => readFileSync(`test/samples/${name}.txt`, "utf8");

describe("queries", () => {
  let db: Db;
  let scrimId: number;
  let mapId: number;

  beforeAll(async () => {
    db = await createTestDb();
    scrimId = await createScrim(db, { name: "vs Cerberus", date: "2026-09-10", opponentName: "Cerberus" });
    const parsed = parseLog(sample("Log-2026-04-15-21-12-58"));
    mapId = await insertParsedMap(db, { scrimId, ourSide: 2, parsed, meta: deriveMapMeta(parsed), originalFilename: "a.txt" });
  });

  it("lists scrims with map counts and our record", async () => {
    const empty = await createScrim(db, { name: "empty", date: "2026-09-01", opponentName: "Nobody" });
    const list = await listScrims(db);
    expect(list.map((s) => s.id)).toEqual([scrimId, empty]);
    expect(list[0]).toMatchObject({ name: "vs Cerberus", mapCount: 1, wins: 0, losses: 1 });
    expect(list[1]).toMatchObject({ mapCount: 0, wins: 0, losses: 0 });
    await deleteScrim(db, empty);
  });

  it("gets a scrim with its maps in order and a map with its scrim", async () => {
    const scrim = await getScrim(db, scrimId);
    expect(scrim?.maps.map((m) => m.mapName)).toEqual(["Antarctic Peninsula"]);
    const map = await getMap(db, mapId);
    expect(map?.scrim.name).toBe("vs Cerberus");
    expect(await getScrim(db, 999_999)).toBeNull();
  });

  it("returns player stats and kills for a map", async () => {
    const { playerStats, kills } = await getMapStats(db, mapId);
    expect(playerStats).toHaveLength(40);
    expect(kills).toHaveLength(58);
    expect(kills[0].matchTime).toBeLessThanOrEqual(kills[1].matchTime);
  });

  it("sets a manual winner", async () => {
    await setMapWinner(db, mapId, 2);
    expect((await getMap(db, mapId))?.map).toMatchObject({ winnerSide: 2, winnerSource: "manual" });
  });

  it("deletes a map and then the scrim, returning raw log paths", async () => {
    expect(await deleteMap(db, mapId)).toBeNull();
    expect((await getScrim(db, scrimId))?.maps).toEqual([]);
    expect(await deleteScrim(db, scrimId)).toEqual([]);
    expect(await getScrim(db, scrimId)).toBeNull();
  });
});
