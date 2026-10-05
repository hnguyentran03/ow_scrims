import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim } from "@/lib/db/queries";
import { healing, maps, playerStat, scrims } from "@/lib/db/schema";
import { handleUpload } from "@/lib/upload";
import { extendAliasMap, type AliasMap } from "@/lib/anonymise";
import { applyAliases, clearRawLogPaths, collectNames, verifyAnonymised } from "@/lib/anonymise-db";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let db: Db;
let realPlayers: string[];

beforeAll(async () => {
  db = await createTestDb();
  const logDir = mkdtempSync(path.join(tmpdir(), "ow-anon-"));
  const scrimId = await createScrim(db, { name: "vs Team Rocket", date: "2026-09-17", opponentName: "Team Rocket" });
  const text = readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8");
  await handleUpload(db, { scrimId, file: new File([text], "a.txt"), ourSide: 1, logDir });
  realPlayers = (await db.selectDistinct({ n: playerStat.playerName }).from(playerStat)).map((r) => r.n);
  // This sample log has no healing events, so there is no existing row to clone. Insert one by
  // hand: a health-pack row carrying the "0" sentinel as the healer, with a real healee name so
  // the test proves both that the sentinel survives and that a real name in this table is swept.
  const [m] = await db.select({ id: maps.id }).from(maps);
  await db.insert(healing).values({
    mapId: m.id,
    matchTime: 0,
    healerTeam: "Team 1",
    healerName: "0",
    healerHero: "Mercy",
    healeeTeam: "Team 1",
    healeeName: realPlayers[0],
    healeeHero: "Mercy",
    eventAbility: "Health Pack",
    eventHealing: 0,
    isHealthPack: "True",
  });
});

describe("collectNames", () => {
  it("unions player and team names and skips sentinels and default labels", async () => {
    const { all, players, teams } = await collectNames(db);
    for (const p of realPlayers) expect(players.has(p)).toBe(true);
    expect(players.has("0")).toBe(false);
    expect(teams.has("Team Rocket")).toBe(true);
    expect(teams.has("Team 1")).toBe(false);
    expect(all.size).toBe(new Set([...players, ...teams]).size);
  });
});

describe("applyAliases / verifyAnonymised / clearRawLogPaths", () => {
  it("rewrites every name column consistently, rewrites the scrim name, and verifies clean", async () => {
    const map: AliasMap = { names: {} };
    const { all } = await collectNames(db);
    extendAliasMap(map, all);
    expect(await verifyAnonymised(db, map)).not.toEqual([]); // real names still present

    const counts = await applyAliases(db, map);
    expect(counts["player_stat.player_name"]).toBeGreaterThan(0);
    expect(counts["kill.attacker_name"]).toBeGreaterThan(0);
    expect(counts["map.team1_name"] + counts["map.team2_name"]).toBeGreaterThanOrEqual(0);

    const after = (await db.selectDistinct({ n: playerStat.playerName }).from(playerStat)).map((r) => r.n);
    expect(after.sort()).toEqual(realPlayers.map((r) => map.names[r]).sort());
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(healing).where(eq(healing.healerName, "0"));
    expect(Number(n)).toBe(1); // sentinel untouched
    const [s] = await db.select().from(scrims);
    expect(s.opponentName).toBe(map.names["Team Rocket"]);
    expect(s.name).toBe(`vs ${map.names["Team Rocket"]}`);

    expect(await verifyAnonymised(db, map)).toEqual([]);

    await clearRawLogPaths(db);
    const [m] = await db.select({ p: maps.rawLogPath }).from(maps);
    expect(m.p).toBeNull();
  });
});
