import { describe, expect, it } from "vitest";
import { MIN_ABILITY_FIGHTS, buildAbilityImpact, type AbilityLike } from "@/lib/stats/ability-impact";
import type { KillLike } from "@/lib/stats/fights";
import type { MapKeyed, StatLike, TeamMapLike } from "@/lib/stats/team-rows";
import { sampleMapRows } from "./sample-rows";

type Kill = KillLike & MapKeyed;
type Ability = AbilityLike & MapKeyed;

const map = (id: number, ourSide = 1): TeamMapLike => ({
  id, scrimId: 1, scrimName: "vs X", scrimDate: "2026-09-10", mapName: "Busan", mapType: "Control", team1Name: "A", team2Name: "B", ourSide, winnerSide: 1, durationSeconds: 600,
});
const kill = (matchTime: number, attackerTeam = "A", victimTeam = "B", mapId = 1): Kill => ({
  mapId, matchTime, attackerTeam, attackerName: `${attackerTeam}p`, victimTeam, victimName: `${victimTeam}p`,
});
const ability = (matchTime: number, playerTeam: string, playerHero: string, slot: 1 | 2, mapId = 1): Ability => ({ mapId, matchTime, playerTeam, playerName: `${playerTeam}-${playerHero}`, playerHero, slot });
const stat = (mapId: number, playerTeam: string, playerHero: string, heroTimePlayed = 600): StatLike => ({
  mapId, roundNumber: 1, playerTeam, playerName: `${playerTeam}-${playerHero}`, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0,
  damageTaken: 0, damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed,
});

// Ten one-kill fights at 0, 100, …, 900 (zero-width windows, so uses land exactly on the start): A wins 1-5, B wins 6-10.
const ten = [...Array(10)].map((_, i) => (i < 5 ? kill(i * 100) : kill(i * 100, "B", "A")));
const stats = [stat(1, "A", "Lúcio"), stat(1, "A", "Ana"), stat(1, "B", "Zarya")];
// Lúcio Crossfade: twice in each won fight, once in lost fights 6-8, once outside every fight (2000).
const crossfade = [
  ...[0, 100, 200, 300, 400].flatMap((t) => [ability(t, "A", "Lúcio", 1), ability(t, "A", "Lúcio", 1)]),
  ...[500, 600, 700].map((t) => ability(t, "A", "Lúcio", 1)),
  ability(2000, "A", "Lúcio", 1),
];
const others = [ability(0, "A", "Nobody", 2), ability(100, "A", "0", 1), ability(500, "B", "Zarya", 2), ability(9999, "C", "Ana", 1)];

describe("buildAbilityImpact", () => {
  const { ours, theirs, hasAbilities } = buildAbilityImpact([map(1)], ten, [...crossfade, ...others], stats);

  it("reports uses per decided fight in won and lost fights, counting a use outside every fight in uses only", () => {
    expect(hasAbilities).toBe(true);
    const lucio = ours.find((r) => r.hero === "Lúcio")!;
    expect(lucio).toMatchObject({ slot: 1, ability: "Crossfade", uses: 14, perFightWon: 2, perFightLost: 0.6 });
    expect(lucio.with).toEqual({ count: 8, decided: 8, won: 5, rate: 5 / 8 });
    expect(lucio.without).toEqual({ count: 2, decided: 2, won: 0, rate: 0 });
    expect(lucio.lift).toBeNull();
  });

  it("names unknown and censored heroes by slot, keeps them in with only, and drops a team that is not on the map", () => {
    expect(ours.map((r) => [r.hero, r.slot, r.ability, r.uses])).toEqual([["Lúcio", 1, "Crossfade", 14], ["0", 1, "Ability 1", 1], ["Nobody", 2, "Ability 2", 1]]);
    const nobody = ours[2];
    expect(nobody.with).toEqual({ count: 1, decided: 1, won: 1, rate: 1 });
    expect(nobody.without).toEqual({ count: 0, decided: 0, won: 0, rate: null });
    expect(nobody.perFightWon).toBeNull();
    expect(theirs.map((r) => [r.hero, r.ability])).toEqual([["Zarya", "Projected Barrier"]]);
    expect(theirs[0].without).toEqual({ count: 9, decided: 9, won: 4, rate: 4 / 9 });
  });

  it("guards the per-fight means and the lift at MIN_ABILITY_FIGHTS", () => {
    expect(MIN_ABILITY_FIGHTS).toBe(5);
    // A wins six one-kill fights, B wins one; Ana is used once in every fight. The lost bucket has one fight, so perFightLost is null.
    const seven = [...[0, 100, 200, 300, 400, 500].map((t) => kill(t)), kill(600, "B", "A")];
    const uses = [0, 100, 200, 300, 400, 500, 600].map((t) => ability(t, "A", "Ana", 2));
    const r = buildAbilityImpact([map(1)], seven, uses, [stat(1, "A", "Ana")]).ours[0];
    expect(r).toMatchObject({ ability: "Biotic Grenade", uses: 7, perFightWon: 1, perFightLost: null, lift: null });
    expect(r.with).toEqual({ count: 7, decided: 7, won: 6, rate: 6 / 7 });
    expect(r.without).toEqual({ count: 0, decided: 0, won: 0, rate: null });
    // Ten fights, Ana used in all ten: with has 10 decided, without has 0, so lift stays null; perFightLost is 1 over five lost fights.
    const all = buildAbilityImpact([map(1)], ten, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((t) => ability(t, "A", "Ana", 2)), [stat(1, "A", "Ana")]).ours[0];
    expect(all).toMatchObject({ perFightWon: 1, perFightLost: 1, lift: null });
    // Ana used in fights 1-5 only: both buckets have five decided fights, so lift is 1 − 0.
    const half = buildAbilityImpact([map(1)], ten, [0, 100, 200, 300, 400].map((t) => ability(t, "A", "Ana", 2)), [stat(1, "A", "Ana")]).ours[0];
    expect(half).toMatchObject({ lift: 1, perFightWon: 1, perFightLost: 0 });
  });

  it("is empty with hasAbilities false when no ability rows were loaded", () => {
    expect(buildAbilityImpact([map(1)], ten, [], stats)).toEqual({ ours: [], theirs: [], hasAbilities: false });
  });

  it("counts a played hero's fights on a map with no uses of a slot into without, across maps, and skips an unlogged map entirely", () => {
    // Map 2 repeats map 1's fight pattern (A wins 1-5, B wins 6-10) but Ana never uses Biotic Grenade there.
    const tenMap2 = [...Array(10)].map((_, i) => (i < 5 ? kill(i * 100, "A", "B", 2) : kill(i * 100, "B", "A", 2)));
    // Map 3 also repeats the pattern but has no ability rows at all: an unlogged map whose fights must count nowhere.
    const tenMap3 = [...Array(10)].map((_, i) => (i < 5 ? kill(i * 100, "A", "B", 3) : kill(i * 100, "B", "A", 3)));
    // Ana's slot 2 used once in each of map 1's five won fights only. A theirs-side row logs map 2 without touching Ana.
    const anaMap1 = [0, 100, 200, 300, 400].map((t) => ability(t, "A", "Ana", 2, 1));
    const abilities = [...anaMap1, ability(0, "B", "Zarya", 1, 2)];
    // Ana and Mercy are both played (via stat rows) on all three maps; Mercy never uses either slot anywhere.
    const threeMapStats = [
      stat(1, "A", "Ana"), stat(2, "A", "Ana"), stat(3, "A", "Ana"),
      stat(1, "A", "Mercy"), stat(2, "A", "Mercy"), stat(3, "A", "Mercy"),
    ];
    const { ours } = buildAbilityImpact([map(1), map(2), map(3)], [...ten, ...tenMap2, ...tenMap3], abilities, threeMapStats);

    const ana = ours.find((r) => r.hero === "Ana")!;
    expect(ana.uses).toBe(5);
    expect(ana.with).toEqual({ count: 5, decided: 5, won: 5, rate: 1 });
    // Without = map 1's five unused, lost fights, plus all ten of map 2's fights (never used there); map 3 is unlogged and contributes nothing.
    expect(ana.without).toEqual({ count: 15, decided: 15, won: 5, rate: 5 / 15 });
    expect(ana.perFightWon).toBe(0.5);
    expect(ana.perFightLost).toBe(0);
    expect(ana.lift).toBe(1 - 5 / 15);

    expect(ours.find((r) => r.hero === "Mercy")).toBeUndefined();
  });

  it("excludes a drawn fight from decided but still counts it, when a used slot is logged on the map", () => {
    // One drawn fight (one kill each way, within the fight gap) plus five decided fights A wins; Ana uses her slot 2 ability in every fight.
    const draw = [kill(0), kill(2, "B", "A")];
    const wonFights = [1000, 1100, 1200, 1300, 1400].map((t) => kill(t));
    const uses = [0, 1000, 1100, 1200, 1300, 1400].map((t) => ability(t, "A", "Ana", 2));
    const r = buildAbilityImpact([map(1)], [...draw, ...wonFights], uses, [stat(1, "A", "Ana")]).ours[0];
    expect(r.with).toEqual({ count: 6, decided: 5, won: 5, rate: 1 });
    expect(r.without).toEqual({ count: 0, decided: 0, won: 0, rate: null });
    expect(r.perFightWon).toBe(1);
    expect(r.perFightLost).toBeNull();
  });

  it("reconciles with the Lijiang sample", () => {
    const l = sampleMapRows("Log-2026-04-02-17-21-48", 1, 1);
    const r = buildAbilityImpact([l.map], l.kills, l.abilities, l.playerStats);
    const all = [...r.ours, ...r.theirs];
    expect(all.filter((x) => x.slot === 1).reduce((n, x) => n + x.uses, 0)).toBe(532);
    expect(all.filter((x) => x.slot === 2).reduce((n, x) => n + x.uses, 0)).toBe(364);
    expect(r.hasAbilities).toBe(true);
  });
});
