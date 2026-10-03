import { describe, expect, it } from "vitest";
import { MIN_IMPACT_FIGHTS, buildUltImpact, bucket, tally } from "@/lib/stats/ult-impact";
import { fightsByMap, groupFights, type KillLike } from "@/lib/stats/fights";
import type { MapKeyed, StatLike, TeamMapLike } from "@/lib/stats/team-rows";
import type { UltLike } from "@/lib/stats/ultimates";
import { sampleMapRows } from "./sample-rows";

type Kill = KillLike & MapKeyed;
type Ult = UltLike & MapKeyed;

const map = (id: number, ourSide = 1): TeamMapLike => ({
  id, scrimId: 1, scrimName: "vs X", scrimDate: "2026-09-10", mapName: "Busan", mapType: "Control", team1Name: "A", team2Name: "B", ourSide, winnerSide: 1, durationSeconds: 600,
});
/** A kills B by default. */
const kill = (matchTime: number, attackerTeam = "A", victimTeam = "B", mapId = 1): Kill => ({
  mapId, matchTime, attackerTeam, attackerName: `${attackerTeam}p`, victimTeam, victimName: `${victimTeam}p`,
});
const ult = (matchTime: number, playerTeam: string, playerHero: string, mapId = 1): Ult => ({ mapId, matchTime, playerTeam, playerName: `${playerTeam}-${playerHero}`, playerHero });
const stat = (mapId: number, playerTeam: string, playerHero: string, heroTimePlayed = 600): StatLike => ({
  mapId, roundNumber: 1, playerTeam, playerName: `${playerTeam}-${playerHero}`, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, healingReceived: 0,
  damageTaken: 0, damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed,
});

// Five fights: 1 [10,12] A wins 2-0; 2 [40,44] B wins 2-1; 3 [100,102] draw; 4 [200] A wins; 5 [300] B wins.
const kills = [kill(10), kill(12), kill(40, "B", "A"), kill(42, "B", "A"), kill(44), kill(100), kill(102, "B", "A"), kill(200), kill(300, "B", "A")];
// Ana: fight 1 and (cast at 99, before fight 3 starts) fight 3. Genji: after every fight, unattributed. Kiriko: fight 2 with no stat row. Zarya (B): fight 2.
const ults = [ult(11, "A", "Ana"), ult(99, "A", "Ana"), ult(500, "A", "Genji"), ult(43, "A", "Kiriko"), ult(41, "B", "Zarya")];
const stats = [stat(1, "A", "Ana"), stat(1, "A", "Genji"), stat(1, "A", "Mei"), stat(1, "B", "Zarya")];

describe("buildUltImpact", () => {
  const { ours, theirs } = buildUltImpact([map(1)], kills, fightsByMap(kills), ults, [], stats);

  it("splits a hero's fights into with and without, counting draws but not winning them", () => {
    expect(ours.map((r) => r.hero)).toEqual(["Ana", "Genji", "Kiriko"]);
    const ana = ours[0];
    expect(ana).toMatchObject({ role: "Support", casts: 2, unattributed: 0, lift: null, conversionKillsPerCast: 1 });
    expect(ana.with).toEqual({ count: 2, decided: 1, won: 1, rate: 1 });
    expect(ana.without).toEqual({ count: 3, decided: 3, won: 1, rate: 1 / 3 });
  });

  it("counts a cast outside every fight as unattributed and puts every fight in without", () => {
    const genji = ours[1];
    expect(genji).toMatchObject({ casts: 1, unattributed: 1, conversionKillsPerCast: 0 });
    expect(genji.with).toEqual({ count: 0, decided: 0, won: 0, rate: null });
    expect(genji.without).toEqual({ count: 5, decided: 4, won: 2, rate: 0.5 });
  });

  it("keeps a hero with casts but no stat row in with only, and omits a played hero with no casts", () => {
    const kiriko = ours[2];
    expect(kiriko.with).toEqual({ count: 1, decided: 1, won: 0, rate: 0 });
    expect(kiriko.without).toEqual({ count: 0, decided: 0, won: 0, rate: null });
    expect(kiriko.conversionKillsPerCast).toBe(1);
    expect(ours.some((r) => r.hero === "Mei")).toBe(false);
  });

  it("builds the enemy rows from their point of view", () => {
    expect(theirs.map((r) => r.hero)).toEqual(["Zarya"]);
    expect(theirs[0].with).toEqual({ count: 1, decided: 1, won: 1, rate: 1 });
    expect(theirs[0].without).toEqual({ count: 4, decided: 3, won: 1, rate: 1 / 3 });
    expect(theirs[0].conversionKillsPerCast).toBe(1);
  });

  it("swaps the sides when our side flips", () => {
    const flipped = buildUltImpact([map(1, 2)], kills, fightsByMap(kills), ults, [], stats);
    expect(flipped.ours.map((r) => r.hero)).toEqual(["Zarya"]);
    expect(flipped.theirs.map((r) => r.hero)).toEqual(["Ana", "Genji", "Kiriko"]);
  });

  it("shows lift only when both buckets have at least MIN_IMPACT_FIGHTS decided fights, and sorts lifted rows first", () => {
    expect(MIN_IMPACT_FIGHTS).toBe(5);
    // Ten one-kill fights at 0, 100, …, 900: A wins the first five, B the last five. Casts land exactly on a fight's start.
    const ten = [...Array(10)].map((_, i) => (i < 5 ? kill(i * 100) : kill(i * 100, "B", "A")));
    const tenStats = [stat(1, "A", "Ana"), stat(1, "A", "Genji"), stat(1, "A", "Mei")];
    const ana = [0, 100, 200, 300, 400].map((t) => ult(t, "A", "Ana"));
    const genji = [500, 600, 700, 800, 900].map((t) => ult(t, "A", "Genji"));
    const r = buildUltImpact([map(1)], ten, fightsByMap(ten), [...ana, ...genji, ult(0, "A", "Mei")], [], tenStats).ours;
    expect(r.map((x) => [x.hero, x.lift])).toEqual([["Ana", 1], ["Genji", -1], ["Mei", null]]);
    expect(r[2].with).toEqual({ count: 1, decided: 1, won: 1, rate: 1 });
    // Four Ana casts: with has 4 decided fights, so no lift even though without has 6.
    const four = buildUltImpact([map(1)], ten, fightsByMap(ten), ana.slice(0, 4), [], tenStats).ours;
    expect(four[0]).toMatchObject({ hero: "Ana", lift: null });
    expect(four[0].without).toEqual({ count: 6, decided: 6, won: 1, rate: 1 / 6 });
  });

  it("reconciles with the Busan 2023 sample", () => {
    const b = sampleMapRows("Log-2023-12-12-22-15-10", 2, 1);
    const r = buildUltImpact([b.map], b.kills, fightsByMap(b.kills), b.starts, b.ends, b.playerStats);
    const all = [...r.ours, ...r.theirs];
    expect(all.reduce((n, x) => n + x.casts, 0)).toBe(51);
    // Every hero with a stat row sees all 23 fights; a hero without one sees only its own.
    expect(all.every((x) => x.with.count + x.without.count === 23 || x.without.count === 0)).toBe(true);
    expect(all.some((x) => x.with.count + x.without.count === 23)).toBe(true);
    expect(all.every((x) => x.with.won <= x.with.decided && x.with.decided <= x.with.count)).toBe(true);
  });
});

describe("tally", () => {
  it("treats a winner matching neither side as undecided", () => {
    const [f] = groupFights([kill(10, "C", "D")]);
    const b = bucket();
    tally(b, f, "ours", { ours: "A", theirs: "B" });
    expect(b).toEqual({ count: 1, decided: 0, won: 0 });
  });
});
