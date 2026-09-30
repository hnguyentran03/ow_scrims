import { describe, expect, it } from "vitest";
import { heroPickHeatmap } from "@/lib/stats/hero-heatmap";
import type { StatLike, TeamMapLike } from "@/lib/stats/team-rows";
import { sampleMapRows } from "./sample-rows";

const map = (id: number, over: Partial<TeamMapLike> = {}): TeamMapLike => ({
  id, scrimId: id, scrimName: `vs ${id}`, scrimDate: `2026-09-${String(10 + id).padStart(2, "0")}`, mapName: "Busan", mapType: "Control",
  team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600, ...over,
});
const stat = (mapId: number, playerName: string, playerHero: string, heroTimePlayed: number, over: Partial<StatLike> = {}): StatLike => ({
  mapId, roundNumber: 1, playerTeam: "A", playerName, playerHero, heroTimePlayed,
  eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, damageTaken: 0, damageBlocked: 0,
  ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, ...over,
});

describe("heroPickHeatmap", () => {
  it("has one column per scrim in order and a share per hero and scrim", () => {
    // Scrim 1 has two maps (ids 1 and 2); scrim 2 has one map (id 3).
    const maps = [map(1, { scrimId: 1 }), map(2, { scrimId: 1, scrimDate: "2026-09-11" }), map(3, { scrimId: 2 })];
    const rows = [stat(1, "P", "Tracer", 300), stat(1, "Q", "Ana", 300), stat(2, "P", "Ana", 300), stat(3, "P", "Tracer", 300)];
    const h = heroPickHeatmap(maps, rows);
    expect(h.columns).toEqual([
      { scrimId: 1, date: "2026-09-11", name: "vs 1", maps: 2 },
      { scrimId: 2, date: "2026-09-13", name: "vs 3", maps: 1 },
    ]);
    expect(h.rows.map((r) => r.hero)).toEqual(["Tracer", "Ana"]);
    expect(h.rows[0]).toMatchObject({ role: "Damage", total: 2, cells: [{ picks: 1, maps: 2, share: 0.5 }, { picks: 1, maps: 1, share: 1 }] });
    expect(h.rows[1].cells).toEqual([{ picks: 2, maps: 2, share: 1 }, { picks: 0, maps: 1, share: 0 }]);
  });
  it("counts a hero once per map however many of us played it, and ignores the other side", () => {
    const rows = [stat(1, "P", "Ana", 300), stat(1, "Q", "Ana", 300), stat(1, "E", "Tracer", 300, { playerTeam: "B" })];
    const h = heroPickHeatmap([map(1)], rows);
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]).toMatchObject({ hero: "Ana", total: 1 });
  });
  it("sorts by role order, then total picks, then name", () => {
    const maps = [map(1), map(2)];
    const rows = [stat(1, "a", "Ana", 1), stat(2, "a", "Ana", 1), stat(1, "b", "Kiriko", 1), stat(1, "c", "Reinhardt", 1), stat(1, "d", "Tracer", 1), stat(1, "e", "Ashe", 1)];
    expect(heroPickHeatmap(maps, rows).rows.map((r) => r.hero)).toEqual(["Reinhardt", "Ashe", "Tracer", "Ana", "Kiriko"]);
  });
  it("is empty with no maps", () => {
    expect(heroPickHeatmap([], [])).toEqual({ columns: [], rows: [] });
  });
  it("pins the sample log", () => {
    const s = sampleMapRows("Log-2026-04-15-21-12-58", 1, 1);
    const h = heroPickHeatmap([s.map], s.playerStats);
    expect(h.columns).toHaveLength(1);
    expect(h.rows.length).toBeGreaterThanOrEqual(5);
    expect(h.rows.every((r) => r.cells[0].share === 1)).toBe(true);
  });
});
