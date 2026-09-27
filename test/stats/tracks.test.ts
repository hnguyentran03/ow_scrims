import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildTracks, collectSamples, DEATH_MARKER_SECONDS, SAMPLE_STEP_SECONDS, TRACK_GAP_SECONDS, type PositionSample, type TrackRows } from "@/lib/stats/tracks";
import { stageWindows, type StageWindow } from "@/lib/stats/stages";
import type { KillLike } from "@/lib/stats/fights";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

const windows: StageWindow[] = [
  { stage: 2, roundNumber: 1, start: 0, end: 100 },
  { stage: 0, roundNumber: 2, start: 100, end: 200 },
];
const sample = (t: number, x: number, z: number, name = "a", team = "Team 1", hero = "Mei"): PositionSample => ({ t, team, name, hero, point: { x, y: 0, z } });
const death = (matchTime: number, victimName: string, victimTeam = "Team 1"): KillLike => ({ matchTime, attackerTeam: "Team 2", attackerName: "e", victimTeam, victimName });

const emptyRows: TrackRows = { kills: [], damage: [], healing: [], ability1: [], ability2: [], ultEnds: [] };

describe("collectSamples", () => {
  it("takes one sample per parseable tuple from every position-bearing row kind", () => {
    const rows: TrackRows = {
      ...emptyRows,
      kills: [{ matchTime: 5, attackerTeam: "Team 1", attackerName: "a", attackerHero: "Mei", victimTeam: "Team 2", victimName: "v", victimHero: "Ana", attackerPosition: "(1, 0, 2)", victimPosition: "2}" }],
      damage: [{ matchTime: 1, attackerTeam: "Team 1", attackerName: "a", attackerHero: "Mei", victimTeam: "Team 2", victimName: "v", victimHero: "Ana", attackerPosition: "(3, 0, 4)", victimPosition: "(5, 0, 6)" }],
      healing: [{ matchTime: 2, healerTeam: "Team 2", healerName: "h", healerHero: "Moira", healeeTeam: "Team 2", healeeName: "v", healeeHero: "Ana", healerPosition: null, healeePosition: "(7, 0, 8)" }],
      ability1: [{ matchTime: 3, playerTeam: "Team 1", playerName: "a", playerHero: "Mei", playerPosition: "(9, 0, 10)" }],
      ability2: [],
      ultEnds: [{ matchTime: 4, playerTeam: "Team 2", playerName: "v", playerHero: null, playerPosition: "(11, 0, 12)" }],
    };
    expect(collectSamples(rows).map((s) => [s.t, s.name, s.hero, s.point.x, s.point.z])).toEqual([
      [1, "a", "Mei", 3, 4], [1, "v", "Ana", 5, 6], [2, "v", "Ana", 7, 8], [3, "a", "Mei", 9, 10], [4, "v", "", 11, 12], [5, "a", "Mei", 1, 2],
    ]);
  });
});

describe("buildTracks", () => {
  it("keeps the last sample per half second and rounds t to two decimals and x, z to one", () => {
    expect(SAMPLE_STEP_SECONDS).toBe(0.5);
    const tracks = buildTracks([sample(10.1, 1.26, 2), sample(10.4, 1.34, 2.06), sample(10.6, 3, 4)], [], windows);
    expect(tracks).toEqual([{ team: "Team 1", name: "a", segments: [{ window: 0, samples: [[10.4, 1.3, 2.1], [10.6, 3, 4]] }] }]);
  });

  it("splits a segment at a gap over TRACK_GAP_SECONDS but not at exactly the gap", () => {
    expect(TRACK_GAP_SECONDS).toBe(6);
    const same = buildTracks([sample(10, 0, 0), sample(16, 1, 1)], [], windows);
    expect(same[0].segments).toHaveLength(1);
    const split = buildTracks([sample(10, 0, 0), sample(16.01, 1, 1)], [], windows);
    expect(split[0].segments.map((s) => s.samples.length)).toEqual([1, 1]);
  });

  it("ends a segment at the player's death and starts a new one at the next sample", () => {
    expect(DEATH_MARKER_SECONDS).toBe(10);
    const tracks = buildTracks([sample(10, 0, 0), sample(12, 1, 1), sample(14, 2, 2)], [death(12, "a")], windows);
    expect(tracks[0].segments.map((s) => s.samples.map((p) => p[0]))).toEqual([[10, 12], [14]]);
    const other = buildTracks([sample(10, 0, 0), sample(12, 1, 1)], [death(11, "a", "Team 2")], windows);
    expect(other[0].segments).toHaveLength(1);
  });

  it("splits at a window change", () => {
    const tracks = buildTracks([sample(99, 0, 0), sample(101, 1, 1)], [], windows);
    expect(tracks[0].segments.map((s) => s.window)).toEqual([0, 1]);
  });

  it("lists roster players with no samples with empty segments, and orders players by team then name", () => {
    const tracks = buildTracks([sample(1, 0, 0, "b", "Team 2")], [], windows, [{ team: "Team 1", name: "a" }, { team: "Team 2", name: "b" }]);
    expect(tracks.map((t) => [t.team, t.name, t.segments.length])).toEqual([["Team 1", "a", 0], ["Team 2", "b", 1]]);
  });

  it("reconciles with the Lijiang sample", () => {
    const parsed = parseLog(readFileSync("test/samples/Log-2026-04-02-17-21-48.txt", "utf8"));
    const meta = deriveMapMeta(parsed);
    const ev = parsed.events as unknown as Record<string, never[]>;
    const rows: TrackRows = { kills: ev.kill, damage: ev.damage, healing: ev.healing, ability1: ev.ability_1_used, ability2: ev.ability_2_used, ultEnds: ev.ultimate_end };
    const w = stageWindows({ mapType: meta.mapType, durationSeconds: meta.durationSeconds, roundStarts: ev.round_start, roundEnds: ev.round_end, objectiveUpdated: [] });
    const samples = collectSamples(rows);
    expect(samples.length).toBeGreaterThan(10_000);
    const tracks = buildTracks(samples, ev.kill, w);
    expect(tracks).toHaveLength(10);
    for (const t of tracks) {
      for (const seg of t.segments) {
        const win = w[seg.window];
        for (const [time] of seg.samples) {
          expect(time).toBeGreaterThanOrEqual(win.start);
          expect(time).toBeLessThanOrEqual(win.end);
        }
      }
    }
  });
});
