import { describe, expect, it } from "vitest";
import {
  MIN_PROFILE_MAPS, MVP_STATS, PLAYSTYLE_BAND, band, buildProfileCards, mainRole, mvpMapScore, ratioOf, roleReference, type ProfileRows,
} from "@/lib/stats/player-cards";
import type { KillLike } from "@/lib/stats/fights";
import type { MapKeyed, StatLike, TeamMapLike } from "@/lib/stats/team-rows";

type Kill = KillLike & MapKeyed;

const map = (id: number, scrimId = 1): TeamMapLike => ({
  id, scrimId, scrimName: `s${scrimId}`, scrimDate: `2026-09-1${scrimId}`, mapName: `Map ${id}`, mapType: "Control", team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600,
});
const stat = (mapId: number, playerTeam: string, playerName: string, playerHero: string, extra: Partial<StatLike> = {}): StatLike => ({
  mapId, roundNumber: 1, playerTeam, playerName, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, damageTaken: 0,
  damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed: 600, ...extra,
});
const kill = (mapId: number, matchTime: number, attackerTeam: string, attackerName: string, victimTeam: string, victimName: string, extra: Partial<Kill> = {}): Kill => ({
  mapId, matchTime, attackerTeam, attackerName, attackerHero: "Ana", victimTeam, victimName, victimHero: "Ana", ...extra,
});

// Three maps, we are A. p1 and p2 are supports (Ana), p3 is Genji, q1 is the enemy tank.
// Support reference per 10 (p1 + p2 over 3600 s): elims 10, final blows 2, deaths 4, hero damage 2000, healing 8000.
// Damage reference per 10 (p3 over 1800 s): final blows 10, elims 14, deaths 5, hero damage 6000.
const maps = [map(1), map(2), map(3, 2)];
const p2 = (mapId: number) => stat(mapId, "A", "p2", "Ana", { eliminations: 10, deaths: 5, heroDamageDealt: 1000, healingDealt: 7000 });
const playerStats = [
  stat(1, "A", "p1", "Ana", { eliminations: 10, finalBlows: 4, deaths: 2, heroDamageDealt: 3000, healingDealt: 9000, damageBlocked: 500 }),
  p2(1),
  stat(1, "A", "p3", "Genji", { eliminations: 30, finalBlows: 10, deaths: 5, heroDamageDealt: 12000 }),
  stat(1, "B", "q1", "Zarya", { heroDamageDealt: 5000 }),
  stat(2, "A", "p1", "Ana", { eliminations: 8, finalBlows: 2, deaths: 4, heroDamageDealt: 2000, healingDealt: 6000 }),
  p2(2),
  stat(2, "A", "p3", "Genji", { eliminations: 6, finalBlows: 10, deaths: 2, heroDamageDealt: 4000 }),
  stat(3, "A", "p1", "Ana", { eliminations: 12, finalBlows: 6, deaths: 3, heroDamageDealt: 4000, healingDealt: 12000, multikillBest: 3, soloKills: 2, objectiveKills: 4 }),
  p2(3),
  stat(3, "A", "p3", "Genji", { eliminations: 6, finalBlows: 10, deaths: 8, heroDamageDealt: 2000 }),
];
const kills: Kill[] = [
  // Map 1 opens at round start 10. p1 final blows at 30, 50, 110 (gaps 20, 20, 60); p1 dies at 70 and to a suicide at 95 (lives 60, 25).
  kill(1, 30, "A", "p1", "B", "q1"), kill(1, 50, "A", "p1", "B", "q1"), kill(1, 70, "B", "q1", "A", "p1"), kill(1, 95, "A", "p1", "A", "p1"), kill(1, 110, "A", "p1", "B", "q1"),
  // Map 2: only an opponent who shares our player's name; nothing here counts for p1.
  kill(2, 40, "B", "p1", "A", "p3"),
  // Map 3 has no round start, so it opens at 0. One final blow at 100 (gap 100); deaths at 20, 50, 500 (lives 20, 30, 450).
  kill(3, 20, "B", "q1", "A", "p1"), kill(3, 50, "B", "q1", "A", "p1"), kill(3, 100, "A", "p1", "B", "q1"), kill(3, 500, "B", "q1", "A", "p1"),
];
const rows: ProfileRows = { playerStats, kills, roundStarts: [{ mapId: 1, matchTime: 10, roundNumber: 1 }, { mapId: 1, matchTime: 10, roundNumber: 1 }] };
const p1 = buildProfileCards(maps, rows, "p1", null);

describe("MVP score", () => {
  it("weights every stat equally per role and inverts deaths", () => {
    expect(MIN_PROFILE_MAPS).toBe(3);
    expect(MVP_STATS.Support.map((s) => [s.key, s.weight, s.invert ?? false])).toEqual([["healingDealt", 1, false], ["eliminations", 1, false], ["heroDamageDealt", 1, false], ["deaths", 1, true]]);
    expect(MVP_STATS.Tank.map((s) => s.key)).toEqual(["eliminations", "heroDamageDealt", "damageBlocked", "deaths"]);
    expect(MVP_STATS.Damage.map((s) => s.key)).toEqual(["finalBlows", "eliminations", "heroDamageDealt", "deaths"]);
    expect(MVP_STATS.Unknown.map((s) => s.key)).toEqual(["eliminations", "heroDamageDealt", "deaths"]);
  });

  it("builds a time-weighted role reference over our side's final rows", () => {
    const ref = roleReference(maps, playerStats);
    const close = (actual: Record<string, number>, expected: Record<string, number>) => {
      for (const [k, v] of Object.entries(expected)) expect(actual[k], k).toBeCloseTo(v, 9);
    };
    close(ref.Support, { eliminations: 10, finalBlows: 2, deaths: 4, heroDamageDealt: 2000, healingDealt: 8000, damageBlocked: 500 / 6 });
    close(ref.Damage, { finalBlows: 10, eliminations: 14, deaths: 5, heroDamageDealt: 6000, healingDealt: 0, damageBlocked: 0 });
    expect(ref.Tank).toEqual({ eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, damageBlocked: 0 });
    // Time weighting: 10 elims in 600 s plus 10 elims in 300 s is 20 per 900 s, not the mean of 10 and 20.
    const weighted = roleReference([map(1)], [stat(1, "A", "a", "Ana", { eliminations: 10 }), stat(1, "A", "b", "Ana", { eliminations: 10, heroTimePlayed: 300 })]);
    expect(weighted.Support.eliminations).toBeCloseTo(20 / 900 * 600, 10);
  });

  it("scores a map as the mean ratio to the role reference times 100, with the zero rules", () => {
    expect(ratioOf(3, 2)).toBe(1.5);
    expect(ratioOf(3, 0)).toBe(1);
    expect(ratioOf(2, 4, true)).toBe(2);
    expect(ratioOf(0, 4, true)).toBe(1);
    expect(ratioOf(4, 0, true)).toBe(1);
    const ref = roleReference(maps, playerStats);
    expect(mvpMapScore([playerStats[0]], "Support", ref)).toBeCloseTo(140.625, 6);
    expect(mvpMapScore([playerStats[4]], "Support", ref)).toBeCloseTo(88.75, 6);
    expect(mvpMapScore([playerStats[7]], "Support", ref)).toBeCloseTo(150.8333, 3);
  });

  it("averages the map scores and counts maps where the player beat every teammate", () => {
    // p3 (Genji) scores 153.6, 114.9, and 59.7; p2 scores 79.4 on every map. p1 is MVP on map 3 only.
    expect(p1.mvp.maps).toBe(3);
    expect(p1.mvp.score).toBeCloseTo(126.736, 2);
    expect(p1.mvp.mvpCount).toBe(1);
    expect(buildProfileCards(maps, rows, "p3", null).mvp.mvpCount).toBe(2);
  });

  it("counts a tie as an MVP map for both players and treats a zero reference or a zero inverted value as par", () => {
    const twins = [1, 2, 3].flatMap((m) => [stat(m, "A", "x", "Ana", { eliminations: 10 }), stat(m, "A", "y", "Ana", { eliminations: 10 })]);
    const tied = buildProfileCards(maps, { playerStats: twins, kills: [], roundStarts: [] }, "x", null);
    expect(tied.mvp).toMatchObject({ maps: 3, mvpCount: 3 });
    expect(tied.mvp.score).toBeCloseTo(100, 9);
    // Deaths: x has none (inverted zero → par), y has 4 per map against a reference of 2 → ratio 0.5.
    const deaths = [1, 2, 3].flatMap((m) => [stat(m, "A", "x", "Ana", { eliminations: 10 }), stat(m, "A", "y", "Ana", { eliminations: 10, deaths: 4 })]);
    const x = buildProfileCards(maps, { playerStats: deaths, kills: [], roundStarts: [] }, "x", null).mvp;
    const y = buildProfileCards(maps, { playerStats: deaths, kills: [], roundStarts: [] }, "y", null).mvp;
    expect(x).toMatchObject({ maps: 3, mvpCount: 3 });
    expect(x.score).toBeCloseTo(100, 9);
    expect(y).toMatchObject({ maps: 3, mvpCount: 0 });
    expect(y.score).toBeCloseTo(87.5, 9);
  });

  it("uses the player's main role under all heroes and the hero's role under a filter", () => {
    expect(mainRole([stat(1, "A", "x", "Ana", { heroTimePlayed: 300 }), stat(1, "A", "x", "Genji", { heroTimePlayed: 300 })])).toBe("Damage");
    expect(mainRole([stat(1, "A", "x", "Ana", { heroTimePlayed: 301 }), stat(1, "A", "x", "Genji", { heroTimePlayed: 300 })])).toBe("Support");
    expect(buildProfileCards(maps, rows, "p1", "Genji").mvp).toEqual({ score: null, maps: 0, mvpCount: 0 });
  });

  it("returns a null score below MIN_PROFILE_MAPS but still reports maps and MVP count", () => {
    const two = buildProfileCards(maps.slice(0, 2), rows, "p1", null);
    expect(two.mvp).toMatchObject({ score: null, maps: 2 });
    expect(two.deadlift).toBeNull();
    expect(two.playStyle).toBeNull();
    expect(two.drought).not.toBeNull();
    expect(two.records.length).toBeGreaterThan(0);
  });
});

describe("deadlift share", () => {
  it("averages the player's share of our hero damage per map and keeps the best map", () => {
    // Team damage 16000, 7000, 7000; p1 shares 0.1875, 2/7, 4/7.
    expect(p1.deadlift?.meanShare).toBeCloseTo((0.1875 + 2 / 7 + 4 / 7) / 3, 10);
    expect(p1.deadlift?.best).toEqual({ mapId: 3, scrimId: 2, mapName: "Map 3", scrimDate: "2026-09-12", share: 4 / 7 });
  });
});

describe("drought", () => {
  it("measures gaps between final blows from the first deduped round start, ignoring the tail and other players", () => {
    expect(p1.drought).toEqual({ longestSeconds: 100, longestMap: { mapId: 3, scrimId: 2, mapName: "Map 3", scrimDate: "2026-09-12" }, meanSeconds: 50 });
    expect(buildProfileCards(maps, rows, "p2", null).drought).toBeNull();
  });
});

describe("personal records", () => {
  it("keeps the best map per record, omits records that are zero everywhere, and measures the longest life", () => {
    const byKey = Object.fromEntries(p1.records.map((r) => [r.key, r]));
    expect(Object.keys(byKey)).toEqual(["finalBlows", "eliminations", "heroDamage", "healing", "damageBlocked", "multikillBest", "soloKills", "objectiveKills", "longestLife"]);
    expect(byKey.finalBlows).toMatchObject({ label: "Final blows", value: 6, mapId: 3 });
    expect(byKey.damageBlocked).toMatchObject({ value: 500, mapId: 1 });
    expect(byKey.multikillBest).toMatchObject({ value: 3, mapId: 3 });
    expect(byKey.longestLife).toMatchObject({ label: "Longest life", value: 450, mapId: 3 });
    expect(buildProfileCards(maps, rows, "p2", null).records.map((r) => r.key)).toEqual(["eliminations", "heroDamage", "healing"]);
  });
});

describe("play style", () => {
  it("bands ratios at exactly 1 ± PLAYSTYLE_BAND", () => {
    expect(PLAYSTYLE_BAND).toBe(0.1);
    expect(band(1.1)).toBe("even");
    expect(band(1.1000001)).toBe("high");
    expect(band(0.9)).toBe("even");
    expect(band(0.8999999)).toBe("low");
    expect(band(1)).toBe("even");
  });

  it("compares aggression, survival, and role output to the role reference", () => {
    // p1 per 10: final blows 4, elims 10, deaths 3, healing 9000 → 14/12, 4/3, 9000/8000.
    expect(p1.playStyle?.aggression).toBeCloseTo(14 / 12, 10);
    expect(p1.playStyle?.survival).toBeCloseTo(4 / 3, 10);
    expect(p1.playStyle?.output).toBeCloseTo(1.125, 10);
    expect(p1.playStyle?.bands).toEqual({ aggression: "high", survival: "high", output: "high" });
    expect(p1.playStyle?.sentence).toBe("Aggressive, durable, high output");
    const style = buildProfileCards(maps, rows, "p2", null).playStyle!;
    expect(style.bands).toEqual({ aggression: "low", survival: "low", output: "low" });
    expect(style.sentence).toBe("Passive, fragile, low output");
  });
});
