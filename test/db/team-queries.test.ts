import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim, deleteMap, getMap, getScrim, getTelemetryRows, getTeamRows, recentOurRoster, setMapBans } from "@/lib/db/queries";
import { insertParsedMap } from "@/lib/db/insert-map";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

const sample = (name: string) => readFileSync(`test/samples/${name}.txt`, "utf8");

describe("team queries", () => {
  let db: Db;
  let earlyScrim: number;
  let lateScrim: number;
  let antarctic: number;
  let aatlis: number;

  beforeAll(async () => {
    db = await createTestDb();
    earlyScrim = await createScrim(db, { name: "vs Cerberus", date: "2026-09-10", opponentName: "Cerberus" });
    lateScrim = await createScrim(db, { name: "vs Bots", date: "2026-09-12", opponentName: "Bots" });
    const a = parseLog(sample("Log-2026-04-15-21-12-58"));
    antarctic = await insertParsedMap(db, { scrimId: earlyScrim, ourSide: 2, parsed: a, meta: deriveMapMeta(a), originalFilename: "a.txt" });
    const b = parseLog(sample("Log-2026-09-18-13-52-18"));
    aatlis = await insertParsedMap(db, { scrimId: lateScrim, ourSide: 1, parsed: b, meta: deriveMapMeta(b), originalFilename: "b.txt" });
  });

  it("returns every map in scrim date order with the rows for those maps", async () => {
    const rows = await getTeamRows(db);
    expect(rows.maps.map((m) => [m.id, m.scrimName, m.scrimDate])).toEqual([[antarctic, "vs Cerberus", "2026-09-10"], [aatlis, "vs Bots", "2026-09-12"]]);
    expect(rows.kills).toHaveLength(58 + 76);
    expect(rows.ultStarts).toHaveLength(28 + 25);
    expect(rows.ultEnds).toHaveLength(28 + 25);
    expect(rows.ultCharged).toHaveLength(29 + 56);
    expect(rows.playerStats).toHaveLength(40 + 50);
    expect(rows.bans).toEqual([]);
  });

  it("filters by an inclusive date range and runs no event query for an empty range", async () => {
    expect((await getTeamRows(db, { from: "2026-09-11" })).maps.map((m) => m.id)).toEqual([aatlis]);
    expect((await getTeamRows(db, { to: "2026-09-10" })).maps.map((m) => m.id)).toEqual([antarctic]);
    expect((await getTeamRows(db, { from: "2026-09-12", to: "2026-09-12" })).maps.map((m) => m.id)).toEqual([aatlis]);
    const none = await getTeamRows(db, { from: "2027-01-01" });
    expect(none).toEqual({ maps: [], kills: [], ultStarts: [], ultEnds: [], ultCharged: [], playerStats: [], bans: [] });
  });

  it("replaces one side's bans and returns them with the scrim and the map", async () => {
    await setMapBans(db, aatlis, 1, ["Ana", "Sombra"]);
    await setMapBans(db, aatlis, 2, ["Ana"]);
    await setMapBans(db, aatlis, 1, ["Kiriko"]);
    const scrim = await getScrim(db, lateScrim);
    expect(scrim?.bans.map((b) => [b.side, b.hero]).sort()).toEqual([[1, "Kiriko"], [2, "Ana"]]);
    const map = await getMap(db, aatlis);
    expect(map?.bans).toHaveLength(2);
    expect((await getTeamRows(db, { from: "2026-09-12" })).bans).toHaveLength(2);
    await setMapBans(db, aatlis, 2, []);
    expect((await getMap(db, aatlis))?.bans.map((b) => b.hero)).toEqual(["Kiriko"]);
  });

  it("builds the roster from our side of the most recent uploads", async () => {
    const all = await recentOurRoster(db);
    expect(all).toEqual(new Set(["StellBell", "meowzy", "Dyeonnie", "Kloverr", "sleepyme", "Doomfist", "Bastion", "Ashe", "Baptiste", "Ana"]));
    const latest = await recentOurRoster(db, 1);
    expect(latest).toEqual(new Set(["Doomfist", "Bastion", "Ashe", "Baptiste", "Ana"]));
  });

  it("loads only the tables a page asks for", async () => {
    const rows = await getTeamRows(db, {}, { kills: true });
    expect(rows.maps).toHaveLength(2);
    expect(rows.kills).toHaveLength(58 + 76);
    expect(rows.ultStarts).toEqual([]);
    expect(rows.ultEnds).toEqual([]);
    expect(rows.ultCharged).toEqual([]);
    expect(rows.playerStats).toEqual([]);
    expect(rows.bans).toEqual([]);
    const stats = await getTeamRows(db, {}, { playerStats: true, bans: true });
    expect(stats.kills).toEqual([]);
    expect(stats.playerStats).toHaveLength(40 + 50);
  });

  it("returns the damage rows of a map that logged them, in time order", async () => {
    const rows = await getTelemetryRows(db, aatlis);
    expect(rows.damage).toHaveLength(2690);
    expect(rows.damage[0].matchTime).toBeLessThanOrEqual(rows.damage[1].matchTime);
    expect(rows.damage[0]).toMatchObject({ attackerTeam: "Team 1", attackerHero: "Doomfist", victimHero: "Junker Queen" });
  });

  it("drops bans with the map", async () => {
    await deleteMap(db, aatlis);
    expect((await getTeamRows(db)).bans).toEqual([]);
    expect((await getScrim(db, lateScrim))?.bans).toEqual([]);
  });
});
