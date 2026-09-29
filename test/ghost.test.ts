import { describe, expect, it } from "vitest";
import { ghostFrom, ghostOptions } from "@/lib/ghost";
import type { Replay, ReplayStage } from "@/lib/stats/replay";

const stage = (stage: number, roundNumber: number, start: number, end: number): ReplayStage => ({
  stage, roundNumber, start, end, label: `S${stage} R${roundNumber}`, image: null, bounds: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 },
});

describe("ghostOptions", () => {
  it("offers the current map's other same-stage windows first, then other maps' same-stage windows", () => {
    const current = { mapId: 1, stages: [stage(0, 1, 0, 100), stage(0, 2, 100, 200)], windowIndex: 0 };
    const others = [{ mapId: 2, scrimName: "vs Y", scrimDate: "2026-09-01", map: { mapName: "Gibraltar", mapType: "Escort" }, stages: [stage(0, 1, 0, 90), stage(0, 2, 90, 180)] }];
    expect(ghostOptions(current, others, { scrimName: "vs X", scrimDate: "2026-09-10" })).toEqual([
      { mapId: 1, window: 1, label: "vs X · 2026-09-10 · S0 R2" },
      { mapId: 2, window: 0, label: "vs Y · 2026-09-01 · Round 1" },
      { mapId: 2, window: 1, label: "vs Y · 2026-09-01 · Round 2" },
    ]);
  });

  it("offers nothing from a Control map's other rounds because they are other stages", () => {
    const current = { mapId: 1, stages: [stage(2, 1, 0, 100), stage(0, 2, 100, 200)], windowIndex: 0 };
    expect(ghostOptions(current, [], { scrimName: "x", scrimDate: "d" })).toEqual([]);
  });
});

describe("ghostFrom", () => {
  const replay: Replay = {
    durationSeconds: 200, hasPositions: true, stages: [stage(2, 1, 0, 100), stage(2, 2, 100, 200)], heroes: [], deaths: [], ults: [], ultStates: [], feed: [],
    players: [{ team: "A", name: "a", side: "ours", segments: [{ window: 0, samples: [[5, 0, 0]] }, { window: 1, samples: [[150, 1, 1]] }] }],
    kills: [{ t: 20, kind: "kill", attacker: null, victim: { team: "B", name: "b", hero: "Ana", x: 1, z: 1 }, method: "" }, { t: 120, kind: "kill", attacker: null, victim: { team: "B", name: "b", hero: "Ana", x: 1, z: 1 }, method: "" }],
  };

  it("keeps only the source window's segments and kills, re-tagged to the target window, with its first kill", () => {
    const g = ghostFrom(replay, 1, 0, "ghost")!;
    expect(g).toMatchObject({ label: "ghost", start: 100, end: 200, firstKill: 120 });
    expect(g.players[0].segments).toEqual([{ window: 0, samples: [[150, 1, 1]] }]);
    expect(g.kills.map((k) => k.t)).toEqual([120]);
    expect(ghostFrom(replay, 5, 0, "x")).toBeNull();
  });
});
