import { describe, expect, it } from "vitest";
import { parseHeatmapFilters, playerKey } from "@/lib/heatmap-filters";

const stage = (start: number, end: number) => ({ stage: 0, roundNumber: 1, label: "Map", start, end, image: null, bounds: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 } });
const replay = {
  stages: [stage(0, 100), stage(100, 200)],
  players: [
    { team: "Team 1", name: "a", side: "ours" as const, segments: [] },
    { team: "Team 2", name: "x|y", side: "theirs" as const, segments: [] },
  ],
};

describe("parseHeatmapFilters", () => {
  it("defaults to the first stage, both sides, no player", () => {
    expect(parseHeatmapFilters({}, replay)).toEqual({ stage: 0, side: "both", player: null });
  });

  it("drops an out-of-range or non-integer stage", () => {
    expect(parseHeatmapFilters({ stage: "2" }, replay).stage).toBe(0);
    expect(parseHeatmapFilters({ stage: "1.5" }, replay).stage).toBe(0);
    expect(parseHeatmapFilters({ stage: "-1" }, replay).stage).toBe(0);
    expect(parseHeatmapFilters({ stage: "1" }, replay).stage).toBe(1);
  });

  it("accepts only ours, theirs, or both", () => {
    expect(parseHeatmapFilters({ side: "theirs" }, replay).side).toBe("theirs");
    expect(parseHeatmapFilters({ side: "us" }, replay).side).toBe("both");
    expect(parseHeatmapFilters({ side: ["ours", "theirs"] }, replay).side).toBe("both");
  });

  it("ignores an unknown player and matches keys exactly even when the name contains the separator", () => {
    expect(parseHeatmapFilters({ player: "Team 1|zzz" }, replay).player).toBeNull();
    expect(parseHeatmapFilters({ player: "Team 2|x|y" }, replay).player).toEqual({ team: "Team 2", name: "x|y", side: "theirs" });
  });

  it("makes a player filter imply that player's side", () => {
    const f = parseHeatmapFilters({ player: playerKey({ team: "Team 1", name: "a" }), side: "theirs" }, replay);
    expect(f.side).toBe("ours");
  });
});
