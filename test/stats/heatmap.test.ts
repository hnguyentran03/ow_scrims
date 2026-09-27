import { describe, expect, it } from "vitest";
import { buildHeatmap, cellAt, gridFor, HEATMAP_CELLS, type HeatDamageLike, type HeatHealLike, type HeatKillLike } from "@/lib/stats/heatmap";
import type { Replay } from "@/lib/stats/replay";
import { buildReplay } from "@/lib/stats/replay";
import { groupFights } from "@/lib/stats/fights";
import { sides } from "@/lib/stats/sides";
import { replayRowsFromLog } from "./replay-rows";

type Stage = Replay["stages"][number];
const identity = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
const stage = (start: number, end: number, image: Stage["image"] = null): Stage => ({ stage: 0, roundNumber: 1, label: "Map", start, end, image, bounds: identity });
const s = { ours: "Team 1", theirs: "Team 2" };
const pos = (x: number, z: number) => `(${x}, 0, ${z})`;
const kill = (t: number, attackerTeam: string, attackerName: string, victimTeam: string, victimName: string, ax: number, az: number, vx: number, vz: number, extra: Partial<HeatKillLike> = {}): HeatKillLike => ({
  matchTime: t, attackerTeam, attackerName, attackerHero: "Ana", victimTeam, victimName, victimHero: "Mei", attackerPosition: pos(ax, az), victimPosition: pos(vx, vz), isEnvironmental: "False", ...extra,
});
const dmg = (t: number, attackerTeam: string, attackerName: string, victimTeam: string, amount: number, x: number, z: number): HeatDamageLike => ({
  matchTime: t, attackerTeam, attackerName, attackerHero: "Ana", victimTeam, victimName: "v", eventDamage: amount, attackerPosition: pos(x, z),
});
const heal = (t: number, healerTeam: string, healerName: string, amount: number, x: number, z: number, isHealthPack = "False"): HeatHealLike => ({
  matchTime: t, healerTeam, healerName, healerHero: "Ana", eventHealing: amount, isHealthPack, healerPosition: pos(x, z),
});
const player = (team: string, name: string, side: "ours" | "theirs", segments: Replay["players"][number]["segments"] = []) => ({ team, name, side, segments });
const both = { stage: 0, side: "both" as const, player: null };

describe("gridFor and cellAt", () => {
  it("uses 40 cells on the longer axis and square cells", () => {
    const g = gridFor(stage(0, 1, { id: 1, width: 800, height: 400, affine: identity }));
    expect(g).toMatchObject({ cols: HEATMAP_CELLS, rows: 20, cellW: 20, cellH: 20, width: 800, height: 400 });
    const p = gridFor(stage(0, 1, { id: 1, width: 300, height: 600, affine: identity }));
    expect(p).toMatchObject({ cols: 20, rows: HEATMAP_CELLS, cellW: 15, cellH: 15 });
  });

  it("covers the blank plane with 40 by 40", () => {
    expect(gridFor(stage(0, 1))).toMatchObject({ cols: 40, rows: 40, cellW: 25, cellH: 25, width: 1000, height: 1000 });
  });

  it("puts the far corner in the last cell and drops points outside the viewBox", () => {
    const g = gridFor(stage(0, 1));
    expect(cellAt(g, 1000, 1000)).toEqual({ c: 39, r: 39 });
    expect(cellAt(g, 0, 0)).toEqual({ c: 0, r: 0 });
    expect(cellAt(g, 1000.01, 5)).toBeNull();
    expect(cellAt(g, -0.01, 5)).toBeNull();
  });
});

describe("buildHeatmap point layers", () => {
  const replay = { stages: [stage(0, 100), stage(100, 200)], players: [player("Team 1", "a", "ours"), player("Team 2", "x", "theirs")] };
  const kills = [
    kill(10, "Team 1", "a", "Team 2", "x", 100, 200, 300, 400),
    kill(20, "Team 2", "x", "Team 1", "a", 500, 600, 700, 800),
    kill(30, "Team 2", "x", "Team 2", "x", 50, 50, 50, 50, { isEnvironmental: "True" }),
    kill(150, "Team 1", "a", "Team 2", "x", 1, 2, 3, 4),
  ];
  const fights = groupFights(kills);
  const empty = { damage: [], healing: [] };

  it("uses attacker positions for kills and victim positions for deaths, counted kills only in the kills layer", () => {
    const h = buildHeatmap({ replay, sides: s, rows: { kills, ...empty }, fights, filter: both });
    expect(h.points.kills.map((m) => [m.px, m.py, m.side])).toEqual([[100, 200, "ours"], [500, 600, "theirs"]]);
    expect(h.points.deaths.map((m) => [m.px, m.py, m.kind])).toEqual([[300, 400, "kill"], [700, 800, "kill"], [50, 50, "environmental"]]);
    expect(h.points.kills[0].label).toBe("a → x");
  });

  it("keeps only rows inside the chosen window", () => {
    const h = buildHeatmap({ replay, sides: s, rows: { kills, ...empty }, fights, filter: { ...both, stage: 1 } });
    expect(h.points.kills).toHaveLength(1);
    expect(h.points.kills[0].t).toBe(150);
  });

  it("filters by side and by player", () => {
    const ours = buildHeatmap({ replay, sides: s, rows: { kills, ...empty }, fights, filter: { ...both, side: "ours" } });
    expect(ours.points.kills.map((m) => m.name)).toEqual(["a"]);
    expect(ours.points.deaths.map((m) => m.name)).toEqual(["a"]);
    const x = buildHeatmap({ replay, sides: s, rows: { kills, ...empty }, fights, filter: { stage: 0, side: "theirs", player: { team: "Team 2", name: "x", side: "theirs" } } });
    expect(x.points.kills.map((m) => m.name)).toEqual(["x"]);
    expect(x.points.deaths.map((m) => m.name)).toEqual(["x", "x"]);
  });

  it("places one fight centre per fight at the mean victim position", () => {
    const h = buildHeatmap({ replay, sides: s, rows: { kills, ...empty }, fights, filter: both });
    expect(h.points.fights).toHaveLength(1);
    expect(h.points.fights[0]).toMatchObject({ px: (300 + 700 + 50) / 3, py: (400 + 800 + 50) / 3, label: "Fight 1", t: 10 });
  });

  it("skips rows whose tuple is unparseable", () => {
    const broken = [kill(10, "Team 1", "a", "Team 2", "x", 1, 1, 1, 1, { attackerPosition: "2}", victimPosition: null })];
    const h = buildHeatmap({ replay, sides: s, rows: { kills: broken, ...empty }, fights: groupFights(broken), filter: both });
    expect(h.points.kills).toEqual([]);
    expect(h.points.deaths).toEqual([]);
    expect(h.points.fights).toEqual([]);
  });
});

describe("buildHeatmap against the Lijiang sample", () => {
  it("counts every kill row's death per round window", () => {
    const { map, rows } = replayRowsFromLog("Log-2026-04-02-17-21-48");
    const sd = sides(map);
    const replay = buildReplay({ map, sides: sd, rows, images: [] });
    const fights = groupFights(rows.kills);
    const deaths = replay.stages.map((_, i) => buildHeatmap({ replay, sides: sd, rows, fights, filter: { ...both, stage: i } }).points.deaths.length);
    expect(deaths).toEqual([25, 33, 22]);
    const first = buildHeatmap({ replay, sides: sd, rows, fights, filter: both });
    expect(first.points.kills.length).toBeGreaterThan(0);
    expect(first.points.kills.length).toBeLessThanOrEqual(25);
    for (const m of [...first.points.kills, ...first.points.deaths]) {
      expect(m.px).toBeGreaterThanOrEqual(0);
      expect(m.px).toBeLessThanOrEqual(first.grid.width);
      expect(m.py).toBeGreaterThanOrEqual(0);
      expect(m.py).toBeLessThanOrEqual(first.grid.height);
    }
  });
});
