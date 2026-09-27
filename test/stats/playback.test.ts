import { describe, expect, it } from "vitest";
import { heroAt, parseTimeParam, positionAt, ultStateAt } from "@/lib/stats/playback";
import type { Segment } from "@/lib/stats/tracks";

const segments: Segment[] = [
  { window: 0, samples: [[10, 0, 0], [12, 4, 8]] },
  { window: 0, samples: [[20, 1, 1]] },
];

describe("parseTimeParam", () => {
  it("clamps finite values and falls back to zero", () => {
    expect(parseTimeParam("12.5", 100)).toBe(12.5);
    expect(parseTimeParam("250", 100)).toBe(100);
    expect(parseTimeParam("-3", 100)).toBe(0);
    expect(parseTimeParam("abc", 100)).toBe(0);
    expect(parseTimeParam(["5", "6"], 100)).toBe(0);
    expect(parseTimeParam(undefined, 100)).toBe(0);
  });
});

describe("positionAt", () => {
  it("interpolates inside a segment, sits on a single sample, and hides between segments", () => {
    expect(positionAt(segments, 11)).toEqual({ x: 2, z: 4, window: 0 });
    expect(positionAt(segments, 10)).toEqual({ x: 0, z: 0, window: 0 });
    expect(positionAt(segments, 20)).toEqual({ x: 1, z: 1, window: 0 });
    expect(positionAt(segments, 15)).toBeNull();
    expect(positionAt(segments, 5)).toBeNull();
    expect(positionAt([], 5)).toBeNull();
  });
});

describe("heroAt", () => {
  const heroes = [
    { team: "A", name: "p", t: 0, hero: "Mei" },
    { team: "A", name: "p", t: 50, hero: "Ana" },
    { team: "B", name: "q", t: 0, hero: "Zarya" },
  ];
  it("returns the last change at or before t, the first change before any, and empty for a stranger", () => {
    expect(heroAt(heroes, "A", "p", 49.9)).toBe("Mei");
    expect(heroAt(heroes, "A", "p", 50)).toBe("Ana");
    expect(heroAt([{ team: "A", name: "p", t: 30, hero: "Mei" }], "A", "p", 1)).toBe("Mei");
    expect(heroAt(heroes, "C", "z", 1)).toBe("");
  });
});

describe("ultStateAt", () => {
  const states = [
    { team: "A", name: "p", t: 30, state: "charged" as const },
    { team: "A", name: "p", t: 40, state: "used" as const },
  ];
  const ults = [{ team: "A", name: "p", hero: "Mei", start: 40, end: 45, x: null, z: null }, { team: "A", name: "p", hero: "Mei", start: 100, end: null, x: null, z: null }];
  it("is charged after the charge, using during the cast, and empty otherwise", () => {
    expect(ultStateAt(states, ults, "A", "p", 29)).toBeNull();
    expect(ultStateAt(states, ults, "A", "p", 35)).toBe("charged");
    expect(ultStateAt(states, ults, "A", "p", 42)).toBe("using");
    expect(ultStateAt(states, ults, "A", "p", 46)).toBeNull();
    expect(ultStateAt(states, ults, "A", "p", 104)).toBe("using");
    expect(ultStateAt(states, ults, "A", "p", 106)).toBeNull();
  });
});
