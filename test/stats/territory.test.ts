import { describe, expect, it } from "vitest";
import { buildTerritory, objectiveFromCalibration, OBJECTIVE_RADIUS_METERS, TERRITORY_MAJORITY } from "@/lib/stats/territory";
import type { Replay } from "@/lib/stats/replay";
import { buildReplay } from "@/lib/stats/replay";
import { groupFights } from "@/lib/stats/fights";
import type { KillLike } from "@/lib/stats/fights";
import { sides } from "@/lib/stats/sides";
import { replayRowsFromLog } from "./replay-rows";

type Stage = Replay["stages"][number];
const identity = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
const stage = (start: number, end: number): Stage => ({ stage: 0, roundNumber: 1, label: "Map", start, end, image: null, bounds: identity });
const seg = (window: number, samples: Array<[number, number, number]>) => ({ window, samples });
const player = (team: string, name: string, side: "ours" | "theirs" | null, segments: ReturnType<typeof seg>[]) => ({ team, name, side, segments });
const noObjective = { objective: null };
const kill = (matchTime: number, attackerTeam: string, victimTeam: string): KillLike => ({
  matchTime, attackerTeam, attackerName: "atk", victimTeam, victimName: "vic",
});

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

describe("objective control", () => {
  const objective = { objective: { x: 0, z: 0 } };
  // Two of ours inside the radius for 2 s, one of theirs inside, one of theirs outside.
  const replay = {
    stages: [stage(0, 100)],
    players: [
      player("A", "a", "ours", [seg(0, [[0, 1, 1], [2, 1, 1]])]),
      player("A", "b", "ours", [seg(0, [[0, -2, 2], [2, -2, 2]])]),
      player("B", "x", "theirs", [seg(0, [[0, 3, 3], [2, 3, 3]])]),
      player("B", "y", "theirs", [seg(0, [[0, 50, 50], [2, 50, 50]])]),
    ],
  };

  it("counts players within the radius per instant and shares over observed instants only", () => {
    expect(OBJECTIVE_RADIUS_METERS).toBe(10);
    const t = buildTerritory({ replay, stage: 0, fights: [], ...objective });
    expect(t.objective).toEqual({ stage: { ours: 1, theirs: 0, contested: 0 }, byFight: [], observedSeconds: 2.5 });
  });

  it("marks equal counts as contested and skips instants with nobody near", () => {
    const even = {
      stages: [stage(0, 100)],
      players: [player("A", "a", "ours", [seg(0, [[0, 1, 1], [1, 1, 1]])]), player("B", "x", "theirs", [seg(0, [[0, 3, 3], [1, 3, 3]]), seg(0, [[10, 0, 0], [11, 0, 0]])])],
    };
    const t = buildTerritory({ replay: even, stage: 0, fights: [], ...objective });
    expect(t.objective?.stage).toEqual({ ours: 0, theirs: 0.5, contested: 0.5 });
    expect(t.objective?.observedSeconds).toBe(3);
  });

  it("reports per-fight shares over the instants inside each fight", () => {
    const fights = groupFights([kill(0.4, "A", "B"), kill(1.2, "A", "B")]);
    const t = buildTerritory({ replay, stage: 0, fights, ...objective });
    expect(t.objective?.byFight).toEqual([{ index: 1, winner: "ours", share: { ours: 1, theirs: 0, contested: 0 } }]);
  });

  it("returns a null objective section when no centre is marked", () => {
    expect(buildTerritory({ replay, stage: 0, fights: [], objective: null }).objective).toBeNull();
  });
});

describe("objectiveFromCalibration", () => {
  it("reads the objective from the stored calibration JSON and rejects anything else", () => {
    expect(objectiveFromCalibration(JSON.stringify({ pairs: [], affine: identity, objective: { x: 1.5, z: -2 } }))).toEqual({ x: 1.5, z: -2 });
    expect(objectiveFromCalibration(JSON.stringify({ pairs: [], affine: identity, objective: null }))).toBeNull();
    expect(objectiveFromCalibration(JSON.stringify({ objective: { x: "1", z: 2 } }))).toBeNull();
    expect(objectiveFromCalibration("not json")).toBeNull();
    expect(objectiveFromCalibration(null)).toBeNull();
  });
});

describe("territory against the Lijiang sample", () => {
  it("produces owned cells in the first round window and no objective section without a centre", () => {
    const { map, rows } = replayRowsFromLog("Log-2026-04-02-17-21-48");
    const replay = buildReplay({ map, sides: sides(map), rows, images: [] });
    const t = buildTerritory({ replay, stage: 0, fights: groupFights(rows.kills), objective: null });
    expect(t.cells.length).toBeGreaterThan(0);
    expect(new Set(t.cells.map((c) => c.owner))).toEqual(new Set(["ours", "theirs", "contested"].filter((o) => t.cells.some((c) => c.owner === o))));
    expect(t.objective).toBeNull();
  });
});
