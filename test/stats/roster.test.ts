import { describe, expect, it } from "vitest";
import { buildRoster } from "@/lib/stats/roster";
import type { StatLike, TeamMapLike } from "@/lib/stats/team-rows";

const map = (id: number, extra: Partial<TeamMapLike> = {}): TeamMapLike => ({
  id, scrimId: 1, scrimName: "vs X", scrimDate: "2026-09-10", mapName: "Busan", mapType: "Control", team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600, ...extra,
});
const stat = (mapId: number, playerTeam: string, playerName: string, playerHero: string, heroTimePlayed: number): StatLike => ({
  mapId, roundNumber: 1, playerTeam, playerName, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, healingReceived: 0, damageTaken: 0,
  damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed,
});

describe("buildRoster", () => {
  // Map 1 we are A; map 2 we are B. p4 has no time; q1 is an opponent.
  const maps = [map(1), map(2, { ourSide: 2 })];
  const stats = [
    stat(1, "A", "p1", "Ana", 600), stat(1, "A", "p2", "Genji", 300), stat(1, "A", "p3", "Tracer", 120), stat(1, "A", "p4", "Mercy", 0), stat(1, "B", "q1", "Ana", 600),
    stat(2, "B", "p1", "Kiriko", 300), stat(2, "B", "p2", "Reinhardt", 500), stat(2, "A", "q1", "Ana", 600),
  ];

  it("lists our players with maps, time, main role, and top hero, most time first", () => {
    expect(buildRoster(maps, stats)).toEqual([
      { name: "p1", maps: 2, timePlayed: 900, mainRole: "Support", topHero: "Ana" },
      { name: "p2", maps: 2, timePlayed: 800, mainRole: "Tank", topHero: "Reinhardt" },
      { name: "p3", maps: 1, timePlayed: 120, mainRole: "Damage", topHero: "Tracer" },
    ]);
  });

  it("orders by name when timePlayed ties", () => {
    const tied = [stat(1, "A", "p3", "Genji", 600), stat(1, "A", "p2", "Mercy", 600), stat(1, "A", "p1", "Reinhardt", 600)];
    expect(buildRoster([map(1)], tied).map((r) => r.name)).toEqual(["p1", "p2", "p3"]);
  });

  it("is empty with no maps", () => {
    expect(buildRoster([], [])).toEqual([]);
  });
});
