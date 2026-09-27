import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { STAGE_NAMES, stageLabel, stageWindows, windowIndexAt, windowLabel, type RoundStartLike } from "@/lib/stats/stages";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

const rs = (matchTime: number, roundNumber: number, objectiveIndex: number): RoundStartLike => ({ matchTime, roundNumber, objectiveIndex });
const re = (matchTime: number, roundNumber: number) => ({ matchTime, roundNumber });

/** The round and objective rows of a sample, shaped for stageWindows. */
function load(name: string) {
  const parsed = parseLog(readFileSync(`test/samples/${name}.txt`, "utf8"));
  const meta = deriveMapMeta(parsed);
  const rows = <T>(r: unknown[] | undefined) => (r ?? []) as T[];
  return {
    mapType: meta.mapType,
    durationSeconds: meta.durationSeconds,
    roundStarts: rows<RoundStartLike>(parsed.events.round_start),
    roundEnds: rows<{ matchTime: number; roundNumber: number }>(parsed.events.round_end),
    objectiveUpdated: rows<{ matchTime: number; currentObjectiveIndex: number }>(parsed.events.objective_updated),
  };
}

describe("stageWindows", () => {
  it("gives Control one window per round with the round's objective index as its stage", () => {
    const w = stageWindows(load("Log-2026-04-02-17-21-48"));
    expect(w).toEqual([
      { stage: 2, roundNumber: 1, start: 0, end: 245.08 },
      { stage: 0, roundNumber: 2, start: 245.08, end: 512.91 },
      { stage: 1, roundNumber: 3, start: 512.91, end: 744.21 },
    ]);
  });

  it("splits a Flashpoint round at every objective_updated row", () => {
    const w = stageWindows(load("Log-2026-09-18-13-52-18"));
    expect(w).toEqual([
      { stage: 0, roundNumber: 1, start: 0, end: 176.28 },
      { stage: 4, roundNumber: 1, start: 176.28, end: 290.33 },
      { stage: 2, roundNumber: 1, start: 290.33, end: 410.69 },
      { stage: 1, roundNumber: 1, start: 410.69, end: 539.49 },
      { stage: 3, roundNumber: 1, start: 539.49, end: 677.33 },
    ]);
  });

  it("keeps Escort rounds on stage 0 even though checkpoints step the objective index", () => {
    const w = stageWindows(load("Log-2024-01-10-20-38-42"));
    expect(w).toEqual([
      { stage: 0, roundNumber: 1, start: 0, end: 245.05 },
      { stage: 0, roundNumber: 2, start: 245.05, end: 508.88 },
    ]);
    expect(stageWindows({ mapType: "Escort", roundStarts: [rs(0, 1, 0), rs(300, 2, 2)], roundEnds: [re(290, 1), re(600, 2)], objectiveUpdated: [], durationSeconds: 600 }).map((x) => x.stage)).toEqual([0, 0]);
  });

  it("ends a round at the next round start when its round_end is missing, and at the duration for the last", () => {
    const w = stageWindows({ mapType: "Control", roundStarts: [rs(0, 1, 2), rs(300, 2, 0)], roundEnds: [], objectiveUpdated: [], durationSeconds: 650 });
    expect(w).toEqual([
      { stage: 2, roundNumber: 1, start: 0, end: 300 },
      { stage: 0, roundNumber: 2, start: 300, end: 650 },
    ]);
  });

  it("ignores a duplicated round_end and returns one window from 0 to the duration with no round rows", () => {
    const w = stageWindows({ mapType: "Control", roundStarts: [rs(0, 1, 1)], roundEnds: [re(200, 1), re(200, 1)], objectiveUpdated: [], durationSeconds: 200 });
    expect(w).toEqual([{ stage: 1, roundNumber: 1, start: 0, end: 200 }]);
    expect(stageWindows({ mapType: "Push", roundStarts: [], roundEnds: [], objectiveUpdated: [], durationSeconds: 480.5 })).toEqual([{ stage: 0, roundNumber: 1, start: 0, end: 480.5 }]);
  });
});

describe("windowIndexAt", () => {
  const windows = [
    { stage: 2, roundNumber: 1, start: 5, end: 100 },
    { stage: 0, roundNumber: 2, start: 110, end: 200 },
  ];
  it("returns the containing window, the next one for the setup gap and for times before the first, and the last after the end", () => {
    expect(windowIndexAt(50, windows)).toBe(0);
    expect(windowIndexAt(105, windows)).toBe(1);
    expect(windowIndexAt(1, windows)).toBe(0);
    expect(windowIndexAt(250, windows)).toBe(1);
  });
});

describe("labels", () => {
  it("names a known stage, falls back to Stage n, and says Map on single-stage modes", () => {
    STAGE_NAMES["Test Tower"] = ["", "Beta"];
    expect(stageLabel({ mapName: "Test Tower", mapType: "Control" }, 1)).toBe("Beta");
    expect(stageLabel({ mapName: "Test Tower", mapType: "Control" }, 0)).toBe("Stage 0");
    expect(stageLabel({ mapName: "Test Tower", mapType: "Control" }, 2)).toBe("Stage 2");
    expect(stageLabel({ mapName: "Nowhere", mapType: "Flashpoint" }, 0)).toBe("Stage 0");
    expect(stageLabel({ mapName: "Nowhere", mapType: "Escort" }, 0)).toBe("Map");
    delete STAGE_NAMES["Test Tower"];
  });

  it("labels windows with the stage and round, or just the round on single-stage modes", () => {
    expect(windowLabel({ mapName: "Nowhere", mapType: "Control" }, { stage: 1, roundNumber: 3, start: 0, end: 1 })).toBe("Stage 1 · Round 3");
    expect(windowLabel({ mapName: "Nowhere", mapType: "Hybrid" }, { stage: 0, roundNumber: 2, start: 0, end: 1 })).toBe("Round 2");
  });
});
