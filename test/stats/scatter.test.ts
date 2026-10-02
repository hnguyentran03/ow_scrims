import { describe, expect, it } from "vitest";
import { buildScatterPoints, heroesOf, MIN_POINT_SECONDS, PRESETS } from "@/lib/stats/scatter";
import type { StatLike, TeamMapLike } from "@/lib/stats/team-rows";

const map = (id: number, over: Partial<TeamMapLike> = {}): TeamMapLike => ({
  id, scrimId: id, scrimName: `vs ${id}`, scrimDate: `2026-09-${String(10 + id).padStart(2, "0")}`, mapName: "Busan", mapType: "Control",
  team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600, ...over,
});
const stat = (mapId: number, playerName: string, playerHero: string, heroTimePlayed: number, over: Partial<StatLike> = {}): StatLike => ({
  mapId, roundNumber: 1, playerTeam: "A", playerName, playerHero, heroTimePlayed,
  eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, healingReceived: 0, damageTaken: 0, damageBlocked: 0,
  ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, ...over,
});

describe("buildScatterPoints", () => {
  it("plots our final-round rows with the time floor, per 10 minutes", () => {
    const rows = [
      stat(1, "p", "Ana", 300, { heroDamageDealt: 1500, deaths: 2, healingReceived: 900 }),
      stat(1, "p", "Ana", 120, { roundNumber: 0, heroDamageDealt: 999 }),
      stat(1, "q", "Tracer", MIN_POINT_SECONDS - 1),
      stat(1, "e", "Genji", 600, { playerTeam: "B" }),
    ];
    const pts = buildScatterPoints([map(1)], rows);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ scrimId: 1, scrimName: "vs 1", scrimDate: "2026-09-11", mapId: 1, mapName: "Busan", player: "p", hero: "Ana", role: "Support", seconds: 300 });
    expect(pts[0].per10.heroDamage).toBe(3000);
    expect(pts[0].per10.deaths).toBe(4);
    expect(pts[0].per10.healingReceived).toBe(1800);
  });

  it("gives one point per hero when a player swaps, in map then player then hero order", () => {
    const rows = [stat(2, "z", "Tracer", 200), stat(2, "a", "Ana", 200), stat(1, "a", "Reinhardt", 200), stat(1, "a", "Ana", 200)];
    const pts = buildScatterPoints([map(1), map(2)], rows);
    expect(pts.map((p) => [p.mapId, p.player, p.hero])).toEqual([[1, "a", "Ana"], [1, "a", "Reinhardt"], [2, "a", "Ana"], [2, "z", "Tracer"]]);
  });

  it("lists heroes once, by role then name", () => {
    const pts = buildScatterPoints([map(1)], [stat(1, "a", "Tracer", 200), stat(1, "b", "Ana", 200), stat(1, "c", "Tracer", 200), stat(1, "d", "Reinhardt", 200)]);
    expect(heroesOf(pts)).toEqual(["Reinhardt", "Tracer", "Ana"]);
  });

  it("ships four presets with x and y from the catalogue", () => {
    expect(PRESETS.map((p) => [p.key, p.x, p.y])).toEqual([
      ["damage-deaths", "heroDamage", "deaths"], ["blows-deaths", "finalBlows", "deaths"],
      ["taken-healed", "damageTaken", "healingReceived"], ["blocked-taken", "damageBlocked", "damageTaken"],
    ]);
  });
});
