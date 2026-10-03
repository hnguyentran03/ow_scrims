import { describe, expect, it } from "vitest";
import { playerMapMatrix } from "@/lib/stats/player-map-matrix";
import { buildRoster } from "@/lib/stats/roster";
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

describe("playerMapMatrix", () => {
  it("rows follow the roster, columns follow the map table, and a cell holds the player's record on that map", () => {
    const maps = [map(1, { mapName: "Busan" }), map(2, { mapName: "Busan", winnerSide: 2 }), map(3, { mapName: "Ilios", winnerSide: null })];
    const rows = [stat(1, "P", "Ana", 600), stat(2, "P", "Ana", 600), stat(3, "P", "Ana", 600), stat(1, "Q", "Tracer", 300), stat(1, "E", "Ana", 600, { playerTeam: "B" })];
    const m = playerMapMatrix(maps, rows, buildRoster(maps, rows));
    expect(m.columns.map((c) => c.mapName)).toEqual(["Busan", "Ilios"]);
    expect(m.rows.map((r) => r.name)).toEqual(["P", "Q"]);
    expect(m.rows[0].cells).toEqual([
      { played: 2, won: 1, lost: 1, undecided: 0, winRate: 0.5 },
      { played: 1, won: 0, lost: 0, undecided: 1, winRate: null },
    ]);
    expect(m.rows[1].cells).toEqual([{ played: 1, won: 1, lost: 0, undecided: 0, winRate: 1 }, null]);
  });
  it("counts a player once per map even across hero swaps", () => {
    const maps = [map(1)];
    const rows = [stat(1, "P", "Ana", 300), stat(1, "P", "Kiriko", 300)];
    const m = playerMapMatrix(maps, rows, buildRoster(maps, rows));
    expect(m.rows[0].cells[0]).toMatchObject({ played: 1, won: 1 });
  });
  it("keeps a roster name with no stats as a row of nulls", () => {
    const maps = [map(1, { mapName: "Busan" }), map(2, { mapName: "Ilios" })];
    const rows = [stat(1, "P", "Ana", 600)];
    const roster = [...buildRoster(maps, rows), { name: "Z", maps: 0, timePlayed: 0, mainRole: "Support" as const, topHero: "" }];
    const m = playerMapMatrix(maps, rows, roster);
    expect(m.rows.map((r) => r.name)).toEqual(["P", "Z"]);
    expect(m.rows[1].cells).toEqual([null, null]);
  });
  it("is empty with no maps", () => {
    expect(playerMapMatrix([], [], buildRoster([], []))).toEqual({ columns: [], rows: [] });
  });
});
