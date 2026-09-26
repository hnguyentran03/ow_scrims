import { describe, expect, it } from "vitest";
import { buildLeaderboard, buildRoster } from "@/lib/stats/leaderboard";
import type { KillLike } from "@/lib/stats/fights";
import type { MapKeyed, StatLike, TeamMapLike } from "@/lib/stats/team-rows";
import type { UltLike } from "@/lib/stats/ultimates";

const map = (id: number, extra: Partial<TeamMapLike> = {}): TeamMapLike => ({
  id, scrimId: 1, scrimName: "vs X", scrimDate: "2026-09-10", mapName: "Busan", mapType: "Control", team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600, ...extra,
});
const stat = (mapId: number, playerTeam: string, playerName: string, playerHero: string, heroTimePlayed: number, extra: Partial<StatLike> = {}): StatLike => ({
  mapId, roundNumber: 1, playerTeam, playerName, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, damageTaken: 0,
  damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, heroTimePlayed, ...extra,
});
type Kill = KillLike & MapKeyed;
type Ult = UltLike & MapKeyed;

// Map 1 we are A; map 2 we are B. p3 is a 2-minute cameo; p4 has no time; q1 is an opponent.
const maps = [map(1), map(2, { ourSide: 2 })];
const stats = [
  stat(1, "A", "p1", "Ana", 600, { eliminations: 6, deaths: 2, heroDamageDealt: 3000, healingDealt: 6000 }),
  stat(1, "A", "p2", "Genji", 300, { eliminations: 4, deaths: 5, heroDamageDealt: 4000 }),
  stat(1, "A", "p3", "Tracer", 120, { eliminations: 10 }),
  stat(1, "A", "p4", "Mercy", 0),
  stat(1, "B", "q1", "Ana", 600, { eliminations: 50 }),
  stat(2, "B", "p1", "Kiriko", 300, { eliminations: 3, deaths: 1, heroDamageDealt: 1500, healingDealt: 3000 }),
  stat(2, "B", "p2", "Reinhardt", 500, { eliminations: 8, deaths: 3, heroDamageDealt: 4000, damageBlocked: 8000 }),
  stat(2, "A", "q1", "Ana", 600, { eliminations: 50 }),
];
const kills: Kill[] = [
  { mapId: 1, matchTime: 50, attackerTeam: "B", attackerName: "q1", attackerHero: "Ana", victimTeam: "A", victimName: "p1", victimHero: "Lúcio" },
  { mapId: 1, matchTime: 80, attackerTeam: "A", attackerName: "p2", attackerHero: "Genji", victimTeam: "B", victimName: "q1", victimHero: "Lúcio" },
];
const ultEnds: Ult[] = [
  { mapId: 1, matchTime: 50, playerTeam: "A", playerName: "p1", playerHero: "Lúcio" },
  { mapId: 1, matchTime: 80, playerTeam: "B", playerName: "q1", playerHero: "Lúcio" },
];

describe("buildRoster", () => {
  it("lists our players with maps, time, main role, and top hero, most time first", () => {
    expect(buildRoster(maps, stats)).toEqual([
      { name: "p1", maps: 2, timePlayed: 900, mainRole: "Support", topHero: "Ana" },
      { name: "p2", maps: 2, timePlayed: 800, mainRole: "Tank", topHero: "Reinhardt" },
      { name: "p3", maps: 1, timePlayed: 120, mainRole: "Damage", topHero: "Tracer" },
    ]);
  });

  it("is empty with no maps", () => {
    expect(buildRoster([], [])).toEqual([]);
  });
});

describe("buildLeaderboard", () => {
  const lb = buildLeaderboard(maps, stats, kills, ultEnds);
  const board = (key: string) => lb.boards.find((b) => b.key === key)!;

  it("applies the playtime floor and reports how many qualify", () => {
    expect(lb.minSeconds).toBe(600);
    expect(lb.eligibleCount).toBe(2);
    expect(board("eliminations").entries.map((e) => e.name)).not.toContain("p3");
  });

  it("ranks per-10 boards highest first, from sums over total time", () => {
    expect(board("eliminations").entries).toEqual([{ name: "p2", value: 9 }, { name: "p1", value: 6 }]);
    expect(board("heroDamage").entries).toEqual([{ name: "p2", value: 6000 }, { name: "p1", value: 3000 }]);
    expect(board("healing").entries).toEqual([{ name: "p1", value: 6000 }, { name: "p2", value: 0 }]);
    expect(board("damageBlocked").entries).toEqual([{ name: "p2", value: 6000 }, { name: "p1", value: 0 }]);
  });

  it("ranks deaths lowest first", () => {
    expect(board("deaths")).toMatchObject({ label: "Fewest deaths per 10", entries: [{ name: "p1", value: 2 }, { name: "p2", value: 6 }] });
  });

  it("ranks time played as a total and Ajaxes as a count, omitting zero Ajaxes", () => {
    expect(board("timePlayed")).toMatchObject({ unit: "seconds", entries: [{ name: "p1", value: 900 }, { name: "p2", value: 800 }] });
    expect(board("ajaxes")).toMatchObject({ unit: "count", entries: [{ name: "p1", value: 1 }] });
  });

  it("lists the three most played heroes on our side", () => {
    expect(lb.mostPlayedHeroes).toEqual([
      { hero: "Ana", role: "Support", playtime: 600 },
      { hero: "Reinhardt", role: "Tank", playtime: 500 },
      { hero: "Genji", role: "Damage", playtime: 300 },
    ]);
  });

  it("returns empty boards for no maps", () => {
    const empty = buildLeaderboard([], [], [], []);
    expect(empty.boards.map((b) => b.entries)).toEqual([[], [], [], [], [], [], []]);
    expect(empty).toMatchObject({ mostPlayedHeroes: [], eligibleCount: 0 });
  });
});
