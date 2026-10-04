import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/lib/db";
import { maps } from "@/lib/db/schema";
import { createScrim, deleteMap, deleteScrim, getChartRows, getCompareRows, getEventRows, getInitiationDamage, getKillfeedRows, getMap, getMapStats, getReplayRows, getScrim, getTelemetryRows, listSameMapReplays, listScrims, setMapWinner } from "@/lib/db/queries";
import { insertParsedMap } from "@/lib/db/insert-map";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";
import { buildReplay } from "@/lib/stats/replay";
import { sides } from "@/lib/stats/sides";
import { stageWindows } from "@/lib/stats/stages";

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

  it("returns ultimate ends alongside player stats and kills", async () => {
    const { ultimateEnds } = await getMapStats(db, mapId);
    expect(ultimateEnds).toHaveLength(28);
  });

  it("returns killfeed rows", async () => {
    const rows = await getKillfeedRows(db, mapId);
    expect(rows.kills).toHaveLength(58);
    expect(rows.rezzes).toHaveLength(0);
    expect(rows.roundEnds.map((r) => r.roundNumber)).toEqual([1, 2, 3]);
  });

  it("returns event rows", async () => {
    const rows = await getEventRows(db, mapId);
    expect(rows.matchStarts).toHaveLength(1);
    expect(rows.matchEnds).toHaveLength(1);
    expect(rows.roundStarts).toHaveLength(3);
    expect(rows.roundEnds).toHaveLength(3);
    expect(rows.captures).toHaveLength(9);
    expect(rows.swaps).toHaveLength(6);
    expect(rows.ultStarts).toHaveLength(28);
    expect(rows.ultEnds).toHaveLength(28);
    expect(rows.kills).toHaveLength(58);
    expect(rows.ultStarts[0].matchTime).toBeLessThanOrEqual(rows.ultStarts[1].matchTime);
  });

  it("returns chart and compare rows", async () => {
    const chart = await getChartRows(db, mapId);
    expect(chart.kills).toHaveLength(58);
    expect(chart.roundEnds).toHaveLength(3);
    expect(chart.playerStats).toHaveLength(40);
    expect(chart.ultStarts).toHaveLength(28);
    expect(chart.ultEnds).toHaveLength(28);
    expect(chart.ultCharged).toHaveLength(29);
    expect(chart.ultCharged[0].matchTime).toBeLessThanOrEqual(chart.ultCharged[1].matchTime);
    const compare = await getCompareRows(db, mapId);
    expect(compare.playerStats).toHaveLength(40);
  });

  it("returns telemetry rows, with no damage for a map logged without damage events", async () => {
    const rows = await getTelemetryRows(db, mapId);
    expect(rows.damage).toHaveLength(0);
    expect(rows.playerStats).toHaveLength(40);
  });

  it("returns a five-column damage slice for initiation", async () => {
    const r = await getInitiationDamage(db, mapId);
    expect(r).toEqual([]);
    const s2 = await createScrim(db, { name: "positioned", date: "2026-04-02", opponentName: "X" });
    const parsed = parseLog(sample("Log-2026-04-02-17-21-48"));
    const m2 = await insertParsedMap(db, { scrimId: s2, ourSide: 1, parsed, meta: deriveMapMeta(parsed), originalFilename: "b.txt" });
    const r2 = await getInitiationDamage(db, m2);
    expect(r2).toHaveLength(4350);
    expect(Object.keys(r2[0]).sort()).toEqual(["attackerHero", "attackerName", "attackerTeam", "matchTime", "victimTeam"]);
    expect(r2[0].matchTime).toBeLessThanOrEqual(r2[1].matchTime);
    await deleteScrim(db, s2);
  });

  it("loads every row kind the replay needs, ordered by time", async () => {
    const rows = await getReplayRows(db, mapId);
    expect(rows.kills).toHaveLength(58);
    expect(rows.roundStarts.map((r) => r.roundNumber)).toEqual([1, 2, 3]);
    expect(rows.playerStats).toHaveLength(40);
    expect(rows.ultCharged).toHaveLength(29);
    expect(rows.heroSpawns.length).toBeGreaterThan(0);
    expect(rows.heroSwaps).toEqual(rows.swaps);
    expect(rows.damage).toEqual([]);
    expect(rows.healing).toEqual([]);
    expect(rows.ability1).toEqual([]);
    expect(rows.objectiveUpdated).toHaveLength(3);
    expect(rows.healing).toEqual([]);

    expect(rows.kills.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.kills.length; i++) {
      expect(rows.kills[i].matchTime).toBeGreaterThanOrEqual(rows.kills[i - 1].matchTime);
    }

    // heroSpawns share matchTime 0 for several rows, so this also covers the id tiebreak.
    for (let i = 1; i < rows.heroSpawns.length; i++) {
      const prev = rows.heroSpawns[i - 1];
      const cur = rows.heroSpawns[i];
      expect(cur.matchTime).toBeGreaterThanOrEqual(prev.matchTime);
      if (cur.matchTime === prev.matchTime) expect(cur.id).toBeGreaterThan(prev.id);
    }
  });

  it("lists other maps with the same name, newest scrim first, with their round rows", async () => {
    const s2 = await createScrim(db, { name: "vs Cerberus again", date: "2026-09-15", opponentName: "Cerberus" });
    const parsed = parseLog(sample("Log-2026-04-15-21-12-58"));
    const m2 = await insertParsedMap(db, { scrimId: s2, ourSide: 2, parsed, meta: deriveMapMeta(parsed), originalFilename: "c.txt" });
    const rows = await listSameMapReplays(db, "Antarctic Peninsula", mapId);
    expect(rows).toHaveLength(1);
    expect(rows[0].map.id).toBe(m2);
    expect(rows[0].roundStarts).toHaveLength(3);
    await deleteScrim(db, s2);
  });

  it("agrees with buildReplay on stage window boundaries for the same map", async () => {
    const rows = await listSameMapReplays(db, "Antarctic Peninsula", -1);
    const row = rows.find((r) => r.map.id === mapId)!;
    const windows = stageWindows({
      mapType: row.map.mapType,
      roundStarts: row.roundStarts,
      roundEnds: row.roundEnds,
      objectiveUpdated: row.objectiveUpdated,
      durationSeconds: row.map.durationSeconds,
    });
    const replay = buildReplay({ map: row.map, sides: sides(row.map), rows: await getReplayRows(db, mapId), images: [] });
    expect(windows.map(({ stage, roundNumber, start, end }) => ({ stage, roundNumber, start, end }))).toEqual(
      replay.stages.map(({ stage, roundNumber, start, end }) => ({ stage, roundNumber, start, end })),
    );
  });

  it("sets a manual winner and leaves a scored map's score alone", async () => {
    const before = (await getMap(db, mapId))!.map;
    await setMapWinner(db, mapId, 2);
    expect((await getMap(db, mapId))?.map).toMatchObject({ winnerSide: 2, winnerSource: "manual", team1Score: before.team1Score, team2Score: before.team2Score });
  });

  it("gives a Push winner 1 and the loser 0, since the log carries no score", async () => {
    await db.update(maps).set({ mapType: "Push", team1Score: 0, team2Score: 0 }).where(eq(maps.id, mapId));
    await setMapWinner(db, mapId, 1);
    expect((await getMap(db, mapId))?.map).toMatchObject({ winnerSide: 1, team1Score: 1, team2Score: 0 });
    await setMapWinner(db, mapId, 2);
    expect((await getMap(db, mapId))?.map).toMatchObject({ winnerSide: 2, team1Score: 0, team2Score: 1 });
  });

  it("deletes a map and then the scrim, returning raw log paths", async () => {
    expect(await deleteMap(db, mapId)).toBeNull();
    expect((await getScrim(db, scrimId))?.maps).toEqual([]);
    expect(await deleteScrim(db, scrimId)).toEqual([]);
    expect(await getScrim(db, scrimId)).toBeNull();
  });
});
