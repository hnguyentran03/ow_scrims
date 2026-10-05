import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim } from "@/lib/db/queries";
import { healing, maps, playerStat, scrims } from "@/lib/db/schema";
import { handleUpload, parseUpload } from "@/lib/upload";
import { extendAliasMap, type AliasMap } from "@/lib/anonymise";
import { applyAliases, clearUploadMetadata, collectNames, countAliasMatches, verifyAnonymised } from "@/lib/anonymise-db";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** A fixed generator: an unseeded one can hand out a pseudonym that happens to contain a real name, which the scrim-name scan would then flag. */
function seeded(seed = 1) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

let db: Db;
let realPlayers: string[];

beforeAll(async () => {
  db = await createTestDb();
  const logDir = mkdtempSync(path.join(tmpdir(), "ow-anon-"));
  const scrimId = await createScrim(db, { name: "vs Team Rocket", date: "2026-09-17", opponentName: "Team Rocket" });
  const text = readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8");
  await handleUpload(db, { scrimId, upload: await parseUpload(new File([text], "a.txt")), ourSide: 1, logDir });
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

describe("countAliasMatches", () => {
  it("counts the rows each player and team column would rewrite, changing nothing", async () => {
    const map: AliasMap = { names: {} };
    const { all } = await collectNames(db);
    extendAliasMap(map, all, seeded());
    const counts = await countAliasMatches(db, map);
    expect(counts["player_stat.player_name"]).toBe(40);
    expect(counts["kill.attacker_name"]).toBeGreaterThan(0);
    expect(counts["scrim.opponent_name"]).toBe(1);
    const still = (await db.selectDistinct({ n: playerStat.playerName }).from(playerStat)).map((r) => r.n);
    expect(still.sort()).toEqual([...realPlayers].sort()); // a dry run must not write
  });
});

describe("applyAliases / clearUploadMetadata / verifyAnonymised", () => {
  it("rewrites every name column consistently, rewrites the scrim name, and verifies clean", async () => {
    const map: AliasMap = { names: {} };
    const { all } = await collectNames(db);
    extendAliasMap(map, all, seeded());
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

    // Same order as the push: the upload trail is blanked before verification, since a
    // ScrimTime filename carrying a team name would otherwise fail the scan below.
    await clearUploadMetadata(db);
    const [m] = await db.select({ p: maps.rawLogPath, f: maps.originalFilename }).from(maps);
    expect(m.p).toBeNull();
    expect(m.f).toBe("log.txt");

    expect(await verifyAnonymised(db, map)).toEqual([]);
  });
});

describe("verifyAnonymised on free text", () => {
  const map: AliasMap = { names: { Quillfeather: "Qumadi", Ro: "Ri" } };

  it("fails a scrim named after a real name that no player or team column holds", async () => {
    const fresh = await createTestDb();
    await createScrim(fresh, { name: "vs quillfeather (reverse sweep)", date: "2026-10-01", opponentName: "Qumadi" });
    const problems = await verifyAnonymised(fresh, map);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("scrim.name");
    expect(problems[0]).toContain("Quillfeather");
  });

  it("fails a map whose original filename carries a real name, and passes once it is blanked", async () => {
    const fresh = await createTestDb();
    const scrimId = await createScrim(fresh, { name: "Scrim 3", date: "2026-10-01", opponentName: "Qumadi" });
    const text = readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8");
    await handleUpload(fresh, {
      scrimId,
      upload: await parseUpload(new File([text], "Quillfeather vs Team.txt")),
      ourSide: 1,
      logDir: mkdtempSync(path.join(tmpdir(), "ow-anon-")),
    });
    const before = await verifyAnonymised(fresh, map);
    expect(before.filter((p) => p.includes("map.original_filename"))).toHaveLength(1);

    await clearUploadMetadata(fresh);
    expect(await verifyAnonymised(fresh, map)).toEqual(before.filter((p) => !p.includes("map.original_filename")));
  });

  it("ignores real names shorter than three characters, which would match everywhere", async () => {
    const fresh = await createTestDb();
    await createScrim(fresh, { name: "Rocket Round", date: "2026-10-01", opponentName: "Qumadi" });
    expect(await verifyAnonymised(fresh, map)).toEqual([]); // "Ro" is in "Rocket Round" but too short to scan
  });
});
