import { describe, expect, it } from "vitest";
import type { TeamRows } from "@/lib/db/queries";
import { buildPlayerPage, playerHeroes, resolvePlayerName, type PlayerRows } from "@/lib/stats/player";
import type { KillLike } from "@/lib/stats/fights";
import type { MapKeyed, StatLike, TeamMapLike } from "@/lib/stats/team-rows";
import type { UltLike } from "@/lib/stats/ultimates";

// Compile-time check: a TeamRows value (what the player page is actually fed) must satisfy
// PlayerRows, so a schema nullability change fails typecheck here rather than in a page.
const _teamRowsSatisfyPlayerRows: PlayerRows = {} as TeamRows;
void _teamRowsSatisfyPlayerRows;

type Kill = KillLike & MapKeyed;
type Ult = UltLike & MapKeyed;

const map = (id: number, mapName: string, mapType: string, ourSide: number, winnerSide: number | null, scrim: { id: number; name: string; date: string }): TeamMapLike => ({
  id, scrimId: scrim.id, scrimName: scrim.name, scrimDate: scrim.date, mapName, mapType, team1Name: "A", team2Name: "B", ourSide, winnerSide, durationSeconds: 600,
});
const stat = (mapId: number, playerTeam: string, playerName: string, playerHero: string, heroTimePlayed: number, extra: Partial<StatLike> = {}): StatLike => ({
  mapId, roundNumber: 1, playerTeam, playerName, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, healingReceived: 0, damageTaken: 0,
  damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed, ...extra,
});
const kill = (mapId: number, matchTime: number, attackerTeam: string, attackerName: string, attackerHero: string, victimTeam: string, victimName: string, victimHero: string, eventAbility: string): Kill => ({
  mapId, matchTime, attackerTeam, attackerName, attackerHero, victimTeam, victimName, victimHero, eventAbility,
});
const ult = (mapId: number, matchTime: number, playerTeam: string, playerName: string, playerHero: string): Ult => ({ mapId, matchTime, playerTeam, playerName, playerHero });

const s1 = { id: 1, name: "vs X", date: "2026-09-10" };
const s2 = { id: 2, name: "vs Y", date: "2026-09-12" };
// Map 1: we are A, won. Map 2: we are B, lost (A won). Map 3: we are A, undecided.
const maps = [map(1, "Busan", "Control", 1, 1, s1), map(2, "King's Row", "Hybrid", 2, 1, s1), map(3, "Ilios", "Control", 1, null, s2)];
const playerStats = [
  stat(1, "A", "p1", "Ana", 600, { eliminations: 10, finalBlows: 4, deaths: 2, heroDamageDealt: 6000, healingDealt: 9000, damageTaken: 3000, ultimatesEarned: 3, ultimatesUsed: 2 }),
  stat(1, "A", "p1", "Kiriko", 0),
  stat(1, "A", "p2", "Genji", 600, { eliminations: 5 }),
  stat(1, "B", "q1", "Genji", 600, { eliminations: 7 }),
  stat(2, "B", "p1", "Ana", 300, { eliminations: 2, finalBlows: 1, deaths: 3, heroDamageDealt: 2000, healingDealt: 4000, damageTaken: 2000, ultimatesEarned: 1, ultimatesUsed: 1 }),
  stat(2, "B", "p1", "Genji", 5, { eliminations: 1, finalBlows: 1 }),
  stat(2, "A", "p1", "Ana", 600, { eliminations: 99 }), // an opponent who shares our player's name
  stat(3, "A", "p1", "Genji", 295, { eliminations: 8, finalBlows: 6, deaths: 4, heroDamageDealt: 5000, damageTaken: 4000, ultimatesEarned: 2, ultimatesUsed: 2 }),
];
const kills: Kill[] = [
  // Map 1 (ours A). Fight 1 at 10–14: A wins 2–1, first pick p1, first death q1.
  kill(1, 10, "A", "p1", "Ana", "B", "q1", "Genji", "Primary Fire"),
  kill(1, 12, "B", "q2", "Widowmaker", "A", "p1", "Ana", "Secondary Fire"),
  kill(1, 14, "A", "p1", "Ana", "B", "q2", "Widowmaker", "Ability 1"),
  // Fight 2 at 40–42: draw, first pick p2.
  kill(1, 40, "A", "p2", "Genji", "B", "q1", "Genji", "Ultimate"),
  kill(1, 42, "B", "q1", "Genji", "A", "p1", "Ana", "0"),
  // Fight 3 at 100: A wins, first pick p1.
  kill(1, 100, "A", "p1", "Ana", "B", "q3", "Lúcio", "0"),
  // Map 2 (ours B). Fight 1 at 5–9: B wins 2–1 after p1 (Ana) dies first: a reversal.
  kill(2, 5, "A", "r1", "Tracer", "B", "p1", "Ana", "Primary Fire"),
  kill(2, 8, "B", "p1", "Ana", "A", "r1", "Tracer", "Primary Fire"),
  kill(2, 9, "B", "p2", "Reinhardt", "A", "r2", "Sojourn", "Melee"),
  // Fight 2 at 60–70: A wins; p1 (Genji) dies first; the opponent named p1 lands a kill that must not count for us.
  kill(2, 60, "A", "r1", "Tracer", "B", "p1", "Genji", "Primary Fire"),
  kill(2, 70, "A", "p1", "Ana", "B", "p2", "Reinhardt", "Primary Fire"),
  // Map 3 (ours A). One fight at 19–24: A wins 2–1. p1 dies to the environment at t=19, before
  // the fight's first counted kill at t=20 — it counts toward diedToMost and as a first death
  // (any kill row), but never as a first pick or a final blow (those use only counted kills).
  { ...kill(3, 19, "A", "p1", "Genji", "A", "p1", "Genji", "0"), isEnvironmental: "True" },
  kill(3, 20, "A", "p1", "Genji", "B", "s1", "Ana", "Ultimate"),
  kill(3, 22, "A", "p1", "Genji", "B", "s2", "Kiriko", "Ultimate"),
  kill(3, 24, "B", "s1", "Ana", "A", "p1", "Genji", "Primary Fire"),
];
const ultStarts: Ult[] = [ult(1, 11, "B", "q1", "Genji"), ult(1, 30, "A", "p1", "Ana"), ult(1, 95, "A", "p1", "Ana"), ult(2, 50, "B", "p1", "Ana"), ult(3, 18, "A", "p1", "Genji")];
const ultEnds: Ult[] = [ult(1, 13, "B", "q1", "Genji"), ult(1, 38, "A", "p1", "Ana"), ult(1, 105, "A", "p1", "Ana"), ult(3, 26, "A", "p1", "Genji")];
const ultCharged: Ult[] = [ult(1, 20, "A", "p1", "Ana"), ult(1, 90, "A", "p1", "Ana")];
// p1's assists: one inside each of map 1's first ult (30–38) and map 3's ult (18–26); one at t=60 outside any window; one by the opposing "p1" on map 2.
const assists: Ult[] = [ult(1, 33, "A", "p1", "Ana"), ult(3, 21, "A", "p1", "Genji"), ult(1, 60, "A", "p1", "Ana"), ult(2, 52, "A", "p1", "Ana")];
const rows: PlayerRows = { playerStats, kills, ultStarts, ultEnds, ultCharged, roundStarts: [{ mapId: 1, matchTime: 5, roundNumber: 1 }], assists };

describe("playerHeroes", () => {
  it("lists our player's heroes by playtime and nothing for a stranger", () => {
    expect(playerHeroes(maps, playerStats, "p1")).toEqual(["Ana", "Genji"]);
    expect(playerHeroes(maps, playerStats, "q1")).toEqual([]);
    expect(playerHeroes(maps, playerStats, "nobody")).toEqual([]);
  });
});

describe("resolvePlayerName", () => {
  const spacedStat = stat(1, "A", "4head Dog", "Ana", 600);
  const spacedPlayerStats = [...playerStats, spacedStat];

  it("resolves a plain roster name, decodes a name with an encoded space, and returns undefined for a name off the roster", () => {
    expect(resolvePlayerName(maps, playerStats, "p1")).toBe("p1");
    expect(resolvePlayerName(maps, spacedPlayerStats, "4head%20Dog")).toBe("4head Dog");
    expect(resolvePlayerName(maps, playerStats, "100%")).toBeUndefined();
    expect(resolvePlayerName(maps, playerStats, "nobody")).toBeUndefined();
  });
});

describe("buildPlayerPage", () => {
  const p = buildPlayerPage(maps, rows, "p1");
  const ana = buildPlayerPage(maps, rows, "p1", "Ana");
  const genji = buildPlayerPage(maps, rows, "p1", "Genji");

  it("sums across maps before dividing, counting only our side", () => {
    expect(p).toMatchObject({ name: "p1", hero: null, heroes: ["Ana", "Genji"] });
    expect(p.overview).toEqual({
      maps: 3, timePlayed: 1200, record: { won: 1, lost: 1, undecided: 1 }, winRate: 0.5,
      per10: { eliminations: expect.closeTo(10.5, 6), finalBlows: 6, deaths: 4.5, heroDamage: 6500, healing: 6500, healingReceived: 0, damageTaken: 4500, damageBlocked: 0, ultsEarned: 3, ultsUsed: 2.5 },
    });
  });

  it("narrows rows, maps, and win rate under a hero filter, counting a few-second swap as a played map", () => {
    expect(ana.overview).toMatchObject({ maps: 2, timePlayed: 900, record: { won: 1, lost: 1, undecided: 0 }, winRate: 0.5 });
    expect(ana.overview.per10.eliminations).toBe(8);
    expect(ana.winRateByMap.map((r) => r.mapName)).toEqual(["Busan", "King's Row"]);
    expect(genji.overview).toMatchObject({ maps: 2, timePlayed: 300, record: { won: 0, lost: 1, undecided: 1 }, winRate: 0 });
    expect(genji.mostPlayed).toEqual([{ hero: "Genji", role: "Damage", playtime: 300, share: 1 }]);
  });

  it("lists most played heroes with share and time per role in role order", () => {
    expect(p.mostPlayed).toEqual([{ hero: "Ana", role: "Support", playtime: 900, share: 0.75 }, { hero: "Genji", role: "Damage", playtime: 300, share: 0.25 }]);
    expect(p.timeByRole).toEqual([{ role: "Damage", playtime: 300 }, { role: "Support", playtime: 900 }]);
  });

  it("picks the best performance by final blows per 10 among map-hero pairs with three minutes", () => {
    expect(p.bestPerformance).toMatchObject({ mapId: 3, scrimId: 2, scrimName: "vs Y", scrimDate: "2026-09-12", mapName: "Ilios", hero: "Genji", timePlayed: 295, finalBlows: 6, outcome: "undecided" });
    expect(p.bestPerformance?.fbPer10).toBeCloseTo(12.203, 3);
    expect(ana.bestPerformance).toMatchObject({ mapId: 1, hero: "Ana", fbPer10: 4, outcome: "won" });
    expect(buildPlayerPage(maps, rows, "nobody").bestPerformance).toBeNull();
  });

  it("buckets final blows by method with 0 as Other, excluding the map-3 environmental kill (only counted kills are final blows)", () => {
    expect(p.finalBlowsByMethod).toEqual([
      { method: "Primary Fire", count: 2, share: 1 / 3 }, { method: "Ultimate", count: 2, share: 1 / 3 },
      { method: "Ability 1", count: 1, share: 1 / 6 }, { method: "Other", count: 1, share: 1 / 6 },
    ]);
  });

  it("reuses the trends win-rate tables over the player's maps", () => {
    expect(p.winRateByMap.map((r) => [r.mapName, r.won, r.lost, r.undecided])).toEqual([["Busan", 1, 0, 0], ["Ilios", 0, 0, 1], ["King's Row", 0, 1, 0]]);
    expect(p.winRateByType.map((r) => [r.mapType, r.played])).toEqual([["Control", 2], ["Hybrid", 1]]);
  });

  it("ranks heroes died to and final blows on, capped at five (diedToMost counts any kill row, so the environmental row's copied attacker hero, Genji, counts too)", () => {
    expect(p.diedToMost).toEqual([{ hero: "Genji", count: 2 }, { hero: "Tracer", count: 2 }, { hero: "Ana", count: 1 }, { hero: "Widowmaker", count: 1 }]);
    expect(p.finalBlowsOnMost.map((h) => h.hero)).toEqual(["Ana", "Genji", "Kiriko", "Lúcio", "Tracer"]);
    expect(ana.finalBlowsOnMost.map((h) => h.hero)).toEqual(["Genji", "Lúcio", "Tracer", "Widowmaker"]);
  });

  it("charts one point per scrim with per-10 over that scrim's maps", () => {
    expect(p.chart.map((c) => [c.scrimId, c.name, c.date, c.maps])).toEqual([[1, "vs X", "2026-09-10", 2], [2, "vs Y", "2026-09-12", 1]]);
    expect(p.chart[0].per10.eliminations).toBeCloseTo((13 / 905) * 600, 6);
    expect(p.chart[0].per10.deaths).toBeCloseTo((5 / 905) * 600, 6);
    expect(p.chart[1].per10.eliminations).toBeCloseTo((8 / 295) * 600, 6);
  });

  it("returns an empty page for a name not on our roster", () => {
    const none = buildPlayerPage(maps, rows, "nobody");
    expect(none).toMatchObject({ heroes: [], mostPlayed: [], timeByRole: [], finalBlowsByMethod: [], winRateByMap: [], diedToMost: [], finalBlowsOnMost: [], chart: [] });
    expect(none.overview).toEqual({ maps: 0, timePlayed: 0, record: { won: 0, lost: 0, undecided: 0 }, winRate: null, per10: { eliminations: 0, finalBlows: 0, deaths: 0, heroDamage: 0, healing: 0, healingReceived: 0, damageTaken: 0, damageBlocked: 0, ultsEarned: 0, ultsUsed: 0 } });
  });

  it("counts first picks (first counted kill) and first deaths (any kill row) against fights on the player's maps, ", () => {
    // firstPick uses the fight's first counted kill: map 3's environmental row at t=19 is skipped,
    // so the first pick there is still p1's counted kill at t=20 — unchanged from before that row existed.
    expect(p.cards.firstPick).toEqual({ count: 3, fights: 6, won: 3, rate: 0.5 });
    // firstDeath uses the fight's first kill row of any kind: map 3's environmental row at t=19 is
    // p1's first death on that fight, adding one more count and one more win (A, ours, still wins it).
    expect(p.cards.firstDeath).toEqual({ count: 3, fights: 6, won: 2, rate: 0.5 });
  });

  it("restricts the fight cards by hero on the kill row under a filter", () => {
    expect(ana.cards.firstPick).toEqual({ count: 2, fights: 5, won: 2, rate: 0.4 });
    expect(ana.cards.firstDeath).toEqual({ count: 1, fights: 5, won: 1, rate: 0.2 });
    // Under the Genji filter, playerMaps are maps 2 and 3 (genji has hero-time on both), so fights = 2 + 1 = 3.
    // Genji's first deaths are map 2's second fight (t=60, A wins, not ours) and map 3's environmental
    // row (t=19, copied attacker/victim hero Genji, A wins, ours) — count 2, won 1 (map 3 only).
    expect(genji.cards.firstDeath).toEqual({ count: 2, fights: 3, won: 1, rate: 2 / 3 });
  });

  it("counts eliminations during the ult as final blows plus offensive assists inside the window, over the same ults", () => {
    // Final blows per ult are 3 / 1 / 2 (below); assists inside a window add one on map 1 (Ana) and one on map 3 (Genji).
    expect(p.cards.elimsPerUlt).toEqual({ ults: 4, elims: 5, perUlt: 1.25 });
    expect(ana.cards.elimsPerUlt).toEqual({ ults: 3, elims: 2, perUlt: 2 / 3 });
    expect(genji.cards.elimsPerUlt).toEqual({ ults: 1, elims: 3, perUlt: 3 });
  });

  it("counts kills per ult by the events rule, zero for an ult without an end", () => {
    expect(p.cards.killsPerUlt).toEqual({ ults: 4, kills: 3, perUlt: 0.75 });
    expect(ana.cards.killsPerUlt).toEqual({ ults: 3, kills: 1, perUlt: 1 / 3 });
    expect(genji.cards.killsPerUlt).toEqual({ ults: 1, kills: 2, perUlt: 2 });
  });

  it("averages charge and hold seconds over timings that have a charge moment", () => {
    // Only map 1 logs ultimate_charged, and only for p1 on Ana: the casts at 30 and 95 are the two
    // timings with both seconds, so both counts are 2 for p1 and for the Ana filter, and 0 for Genji.
    expect(p.cards).toMatchObject({ avgChargeSeconds: 40, avgHoldSeconds: 7.5, chargeSamples: 2, holdSamples: 2 });
    expect(ana.cards).toMatchObject({ avgChargeSeconds: 40, avgHoldSeconds: 7.5, chargeSamples: 2, holdSamples: 2 });
    expect(genji.cards).toMatchObject({ avgChargeSeconds: null, avgHoldSeconds: null, chargeSamples: 0, holdSamples: 0 });
  });

  it("gives zero counts and null rates for a stranger", () => {
    expect(buildPlayerPage(maps, rows, "nobody").cards).toEqual({
      firstPick: { count: 0, fights: 0, won: 0, rate: null }, firstDeath: { count: 0, fights: 0, won: 0, rate: null },
      killsPerUlt: { ults: 0, kills: 0, perUlt: null }, elimsPerUlt: { ults: 0, elims: 0, perUlt: null }, avgChargeSeconds: null, avgHoldSeconds: null, chargeSamples: 0, holdSamples: 0,
    });
  });

  it("carries the profile cards built from the same maps and filter", () => {
    expect(p.profile.mvp).toMatchObject({ maps: 3 });
    expect(p.profile.mvp.score).not.toBeNull();
    // p1's first counted final blow on map 1 is at t=10, measured from the round start at 5.
    expect(p.profile.drought?.longestSeconds).toBeGreaterThanOrEqual(5);
    // p1's Genji maps: 5 s on map 2 (under MIN_PROFILE_SECONDS, not rated) and 295 s on map 3.
    expect(genji.profile.mvp.maps).toBe(1);
    expect(genji.profile.mvp.score).toBeNull();
    expect(buildPlayerPage(maps, rows, "nobody").profile).toEqual({ mvp: { score: null, maps: 0, mvpCount: 0 }, deadlift: null, drought: null, records: [], playStyle: null });
  });
});
