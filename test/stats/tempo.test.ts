import { describe, expect, it } from "vitest";
import { buildTempo, decayCurve, KILL_WEIGHT, TEMPO_HALF_LIFE_SECONDS, TEMPO_STEP_SECONDS, ULT_WEIGHT } from "@/lib/stats/tempo";
import { groupFights, type KillLike } from "@/lib/stats/fights";
import type { UltLike } from "@/lib/stats/ultimates";
import { sampleRows } from "./sample-rows";

const s = { ours: "Team 1", theirs: "Team 2" };
const kill = (matchTime: number, attackerTeam = "Team 1", extra: Partial<KillLike> = {}): KillLike => ({
  matchTime, attackerTeam, attackerName: `${attackerTeam}-p`, attackerHero: "Mei", victimTeam: attackerTeam === "Team 1" ? "Team 2" : "Team 1", victimName: "v", victimHero: "Ana", ...extra,
});
const ult = (matchTime: number, playerTeam = "Team 1"): UltLike => ({ matchTime, playerTeam, playerName: `${playerTeam}-u`, playerHero: "Ana" });

describe("decayCurve", () => {
  it("halves an impulse every half-life and samples floor(duration / step) + 1 points", () => {
    expect([TEMPO_HALF_LIFE_SECONDS, TEMPO_STEP_SECONDS, KILL_WEIGHT, ULT_WEIGHT]).toEqual([20, 1, 1, 0.5]);
    const points = decayCurve([{ t: 0, value: 1 }], 40.9);
    expect(points).toHaveLength(41);
    expect(points[0]).toEqual({ t: 0, value: 1 });
    expect(points[20].value).toBeCloseTo(0.5, 6);
    expect(points[40].value).toBeCloseTo(0.25, 6);
  });

  it("adds an impulse from the first sample at or after it and ignores nothing before", () => {
    const points = decayCurve([{ t: 2.5, value: -1 }, { t: 2.5, value: 1 }, { t: 5, value: 2 }], 6);
    expect(points.map((p) => Number(p.value.toFixed(4)))).toEqual([0, 0, 0, 0, 0, 2, 2 * 0.5 ** (1 / 20)].map((v) => Number(v.toFixed(4))));
  });

  it("returns one zero point for a zero duration", () => {
    expect(decayCurve([], 0)).toEqual([{ t: 0, value: 0 }]);
  });
});

describe("buildTempo", () => {
  it("signs kills and ults by side, weights ults by half, and filters per series", () => {
    const kills = [kill(10), kill(10, "Team 2"), kill(10, "Team 2")];
    const tempo = buildTempo({ kills, starts: [ult(10)], ends: [], fights: groupFights(kills), durationSeconds: 10, sides: s });
    expect(tempo.series.combined[10].value).toBeCloseTo(-0.5, 6);
    expect(tempo.series.kills[10].value).toBeCloseTo(-1, 6);
    expect(tempo.series.ults[10].value).toBeCloseTo(0.5, 6);
  });

  it("drops suicides, environmental kills, and unknown teams from the curve and markers", () => {
    const kills = [kill(1, "Team 1", { victimTeam: "Team 1", victimName: "Team 1-p" }), kill(2, "Team 1", { isEnvironmental: "True" }), kill(3, "Nobody"), kill(4)];
    const tempo = buildTempo({ kills, starts: [], ends: [], fights: [], durationSeconds: 4, sides: s });
    expect(tempo.markers).toEqual([{ t: 4, kind: "kill", team: "ours", player: "Team 1-p", hero: "Mei" }]);
    expect(tempo.series.combined[4].value).toBeCloseTo(1, 6);
  });

  it("carries fights with side winners and ult markers with the caster", () => {
    const kills = [kill(10), kill(12), kill(100, "Team 2")];
    const tempo = buildTempo({ kills, starts: [ult(11, "Team 2"), ult(11.5, "Team 2")], ends: [], fights: groupFights(kills), durationSeconds: 100, sides: s });
    expect(tempo.fights).toEqual([{ index: 1, start: 10, end: 12, winner: "ours" }, { index: 2, start: 100, end: 100, winner: "theirs" }]);
    expect(tempo.markers.filter((m) => m.kind === "ult")).toEqual([{ t: 11.5, kind: "ult", team: "theirs", player: "Team 2-u", hero: "Ana" }]);
  });

  it("samples the Antarctic map to 662 points and starts negative after the opening Team 2 kill", () => {
    const { starts, ends, kills } = sampleRows("Log-2026-04-15-21-12-58");
    const tempo = buildTempo({ kills, starts, ends, fights: groupFights(kills), durationSeconds: 661.03, sides: s });
    expect(tempo.series.combined).toHaveLength(662);
    expect(tempo.series.combined[29].value).toBeLessThan(0);
    expect(tempo.series.combined[36].value).toBeGreaterThan(0);
    expect(tempo.markers.filter((m) => m.kind === "kill")).toHaveLength(58);
    expect(tempo.markers.filter((m) => m.kind === "ult")).toHaveLength(28);
  });
});
