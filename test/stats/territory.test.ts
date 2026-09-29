import { describe, expect, it } from "vitest";
import { buildTerritory, TERRITORY_MAJORITY } from "@/lib/stats/territory";
import type { Replay } from "@/lib/stats/replay";

type Stage = Replay["stages"][number];
const identity = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
const stage = (start: number, end: number): Stage => ({ stage: 0, roundNumber: 1, label: "Map", start, end, image: null, bounds: identity });
const seg = (window: number, samples: Array<[number, number, number]>) => ({ window, samples });
const player = (team: string, name: string, side: "ours" | "theirs" | null, segments: ReturnType<typeof seg>[]) => ({ team, name, side, segments });
const noObjective = { objective: null };

describe("territory cells", () => {
  it("assigns a cell to the side with at least the majority share, contested otherwise, and omits empty cells", () => {
    expect(TERRITORY_MAJORITY).toBe(0.6);
    const replay = {
      stages: [stage(0, 100)],
      players: [
        player("A", "a", "ours", [seg(0, [[0, 10, 10], [3, 10, 10]])]),      // 3 s in cell (0,0)
        player("B", "x", "theirs", [seg(0, [[0, 10, 10], [2, 10, 10]])]),    // 2 s in cell (0,0): ours 0.6 exactly
        player("A", "b", "ours", [seg(0, [[0, 500, 500], [1, 500, 500]])]),  // 1 s in cell (20,20)
        player("B", "y", "theirs", [seg(0, [[0, 500, 500], [1, 500, 500]])]),// 1 s in cell (20,20): contested
        player("B", "z", "theirs", [seg(0, [[0, 900, 900], [4, 900, 900]])]),// theirs alone
      ],
    };
    const t = buildTerritory({ replay, stage: 0, fights: [], ...noObjective });
    expect(t.cells).toEqual([
      { c: 0, r: 0, owner: "ours", seconds: 5 },
      { c: 20, r: 20, owner: "contested", seconds: 2 },
      { c: 36, r: 36, owner: "theirs", seconds: 4 },
    ]);
    expect(t.objective).toBeNull();
  });

  it("ignores segments outside the chosen window and players with no side", () => {
    const replay = {
      stages: [stage(0, 100), stage(100, 200)],
      players: [player("A", "a", "ours", [seg(1, [[150, 10, 10], [151, 10, 10]])]), player("C", "c", null, [seg(0, [[1, 10, 10], [2, 10, 10]])])],
    };
    expect(buildTerritory({ replay, stage: 0, fights: [], ...noObjective }).cells).toEqual([]);
    expect(buildTerritory({ replay, stage: 1, fights: [], ...noObjective }).cells).toEqual([{ c: 0, r: 0, owner: "ours", seconds: 1 }]);
  });
});
