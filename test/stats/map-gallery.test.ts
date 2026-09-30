import { describe, expect, it } from "vitest";
import { mapGallery, RECENT_LIMIT } from "@/lib/stats/map-gallery";
import type { TeamMapLike } from "@/lib/stats/team-rows";

const map = (id: number, over: Partial<TeamMapLike> = {}): TeamMapLike => ({
  id, scrimId: id, scrimName: `vs ${id}`, scrimDate: `2026-09-${String(10 + id).padStart(2, "0")}`, mapName: "Busan", mapType: "Control",
  team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600, ...over,
});

describe("mapGallery", () => {
  it("keeps the last five outcomes in play order and the latest date", () => {
    const maps = [1, 2, 3, 4, 5, 6, 7].map((id) => map(id, { winnerSide: id % 3 === 0 ? 2 : id === 7 ? null : 1 }));
    const [busan] = mapGallery(maps);
    expect(busan).toMatchObject({ mapName: "Busan", played: 7, won: 4, lost: 2, undecided: 1, lastPlayed: "2026-09-17" });
    expect(busan.recent).toEqual(["lost", "won", "won", "lost", "undecided"]);
    expect(RECENT_LIMIT).toBe(5);
  });
  it("orders tiles like the trends table and gives a short history when few plays", () => {
    const maps = [map(1, { mapName: "Ilios" }), map(2, { mapName: "Busan" }), map(3, { mapName: "Busan", winnerSide: 2 })];
    const tiles = mapGallery(maps);
    expect(tiles.map((t) => t.mapName)).toEqual(["Busan", "Ilios"]);
    expect(tiles[1].recent).toEqual(["won"]);
    expect(tiles[0].winRate).toBe(0.5);
  });
  it("is empty with no maps", () => {
    expect(mapGallery([])).toEqual([]);
  });
});
