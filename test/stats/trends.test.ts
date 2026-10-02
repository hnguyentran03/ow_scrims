import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { heroPicks, ultEconomyByScrim, winRateByMap, winRateByType, type UltRowLike } from "@/lib/stats/trends";
import type { StatLike, TeamMapLike } from "@/lib/stats/team-rows";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

const map = (id: number, mapName: string, mapType: string, winnerSide: number | null, extra: Partial<TeamMapLike> = {}): TeamMapLike => ({
  id, scrimId: 1, scrimName: "vs X", scrimDate: "2026-09-10", mapName, mapType, team1Name: "A", team2Name: "B", ourSide: 1, winnerSide, durationSeconds: 600, ...extra,
});
const stat = (mapId: number, playerTeam: string, playerName: string, playerHero: string, heroTimePlayed: number, extra: Partial<StatLike> = {}): StatLike => ({
  mapId, roundNumber: 1, playerTeam, playerName, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, healingReceived: 0, damageTaken: 0,
  damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed, ...extra,
});
const ult = (mapId: number, matchTime: number, playerName: string, playerTeam = "A"): UltRowLike => ({ mapId, matchTime, playerTeam, playerName, playerHero: "Ana" });

describe("winRateByMap / winRateByType", () => {
  const maps = [map(1, "Busan", "Control", 1), map(2, "Busan", "Control", 2), map(3, "Busan", "Control", null), map(4, "King's Row", "Hybrid", 1), map(5, "Colosseo", "Push", null)];

  it("counts played, won, lost, undecided per map with win rate over decided maps", () => {
    expect(winRateByMap(maps)).toEqual([
      { mapName: "Busan", mapType: "Control", played: 3, won: 1, lost: 1, undecided: 1, winRate: 0.5 },
      { mapName: "Colosseo", mapType: "Push", played: 1, won: 0, lost: 0, undecided: 1, winRate: null },
      { mapName: "King's Row", mapType: "Hybrid", played: 1, won: 1, lost: 0, undecided: 0, winRate: 1 },
    ]);
  });

  it("groups by type in the fixed order", () => {
    expect(winRateByType(maps).map((t) => [t.mapType, t.played, t.winRate])).toEqual([["Control", 3, 0.5], ["Hybrid", 1, 1], ["Push", 1, null]]);
  });

  it("returns nothing for no maps", () => {
    expect(winRateByMap([])).toEqual([]);
    expect(winRateByType([])).toEqual([]);
  });
});

describe("heroPicks", () => {
  const maps = [map(1, "Busan", "Control", 1), map(2, "Ilios", "Control", 2, { ourSide: 2 })];
  const stats = [
    stat(1, "A", "p1", "Ana", 300), stat(1, "A", "p2", "Genji", 300), stat(1, "A", "p2", "Tracer", 0), stat(1, "B", "q1", "Ana", 300),
    stat(2, "B", "p1", "Ana", 200), stat(2, "B", "p2", "Sombra", 200), stat(2, "A", "q1", "Genji", 200),
  ];

  it("counts picks, availability after bans, playtime, and share for our side", () => {
    const picks = heroPicks(maps, stats, [{ mapId: 2, side: 1, hero: "Genji" }, { mapId: 2, side: 2, hero: "Kiriko" }], "ours");
    expect(picks).toEqual([
      { hero: "Ana", role: "Support", picks: 2, available: 2, pickRate: 1, playtime: 500, playtimeShare: 0.5 },
      { hero: "Genji", role: "Damage", picks: 1, available: 1, pickRate: 1, playtime: 300, playtimeShare: 0.3 },
      { hero: "Sombra", role: "Damage", picks: 1, available: 2, pickRate: 0.5, playtime: 200, playtimeShare: 0.2 },
    ]);
  });

  it("flips to the opponents' picks and treats unbanned maps as fully available", () => {
    expect(heroPicks(maps, stats, [], "theirs").map((p) => [p.hero, p.picks, p.available])).toEqual([["Ana", 1, 2], ["Genji", 1, 2]]);
  });

  it("returns nothing for no stats", () => {
    expect(heroPicks(maps, [], [], "ours")).toEqual([]);
  });
});

describe("ultEconomyByScrim", () => {
  it("scales earned and used by map time and averages timings, null when none", () => {
    const maps = [map(1, "Busan", "Control", 1, { durationSeconds: 300 }), map(2, "Ilios", "Control", 1, { durationSeconds: 300 }), map(3, "Nepal", "Control", 1, { scrimId: 2, scrimName: "vs Y", scrimDate: "2026-09-12" })];
    const stats = [stat(1, "A", "p1", "Ana", 300, { ultimatesEarned: 3, ultimatesUsed: 2 }), stat(2, "A", "p1", "Ana", 300, { ultimatesEarned: 3, ultimatesUsed: 2 }), stat(2, "B", "q1", "Ana", 300, { ultimatesEarned: 9, ultimatesUsed: 9 }), stat(3, "A", "p1", "Ana", 600, { ultimatesEarned: 1, ultimatesUsed: 1 })];
    const points = ultEconomyByScrim(maps, stats, [ult(1, 10, "p1"), ult(1, 50, "p1")], [ult(1, 20, "p1"), ult(1, 70, "p1")], []);
    expect(points).toEqual([
      { scrimId: 1, name: "vs X", date: "2026-09-10", maps: 2, earnedPer10: 6, usedPer10: 4, avgChargeSeconds: 20, avgHoldSeconds: 15 },
      { scrimId: 2, name: "vs Y", date: "2026-09-12", maps: 1, earnedPer10: 1, usedPer10: 1, avgChargeSeconds: null, avgHoldSeconds: null },
    ]);
  });

  it("matches the Aatlis sample for our side", () => {
    const parsed = parseLog(readFileSync("test/samples/Log-2026-09-18-13-52-18.txt", "utf8"));
    const meta = deriveMapMeta(parsed);
    const m: TeamMapLike = { id: 1, scrimId: 1, scrimName: "vs Bots", scrimDate: "2026-09-18", ...meta, ourSide: 1 };
    const withMap = <T>(rows: T[] | undefined) => (rows ?? []).map((r) => ({ ...r, mapId: 1 })) as unknown as never[];
    const [p] = ultEconomyByScrim([m], withMap(parsed.events.player_stat), withMap(parsed.events.ultimate_charged), withMap(parsed.events.ultimate_start), withMap(parsed.events.ultimate_end));
    expect(p.earnedPer10).toBeCloseTo(10.63, 2);
    expect(p.usedPer10).toBeCloseTo(10.63, 2);
    expect(p.avgHoldSeconds).toBeGreaterThan(0);
    expect(p.avgChargeSeconds).toBeGreaterThan(0);
  });
});
