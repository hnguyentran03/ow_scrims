import type { HeatmapFilter } from "@/lib/heatmap-filters";
import { applyAffine, PLANE_SIZE } from "./calibration";
import { fightIndexAt, isFlagSet, killKind, type Fight, type KillKind } from "./fights";
import { parsePosition } from "./positions";
import type { Replay } from "./replay";
import { sideOf, type SideKey, type Sides } from "./sides";
import { windowIndexAt } from "./stages";
import { SAMPLE_STEP_SECONDS, type Segment } from "./tracks";

export const HEATMAP_CELLS = 40;

const round1 = (v: number) => Number(v.toFixed(1));

export type StageLike = Replay["stages"][number];

export interface Grid {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  width: number;
  height: number;
}

export interface Marker {
  px: number;
  py: number;
  t: number;
  team: string;
  name: string;
  hero: string;
  label: string;
  side: SideKey | null;
  kind?: KillKind;
}

/** Only non-zero cells are emitted. */
export interface Cell {
  c: number;
  r: number;
  v: number;
}

export interface Route {
  team: string;
  name: string;
  side: SideKey | null;
  fightIndex: number | null;
  /** Projected samples: px, py, and the sample time (kept so the client can cut a route at a fight's first kill). */
  points: Array<[number, number, number]>;
}

export interface Heatmap {
  grid: Grid;
  points: { kills: Marker[]; deaths: Marker[]; fights: Marker[] };
  density: { damage: Cell[]; healing: Cell[]; presence: Cell[] };
  totals: { damage: number; healing: number; presenceSeconds: number };
  routes: Route[];
}

export interface HeatKillLike {
  matchTime: number;
  attackerTeam: string;
  attackerName: string;
  attackerHero?: string;
  victimTeam: string;
  victimName: string;
  victimHero?: string;
  attackerPosition: string | null;
  victimPosition: string | null;
  isEnvironmental?: string;
}

export interface HeatDamageLike {
  matchTime: number;
  attackerTeam: string;
  attackerName: string;
  attackerHero: string;
  victimTeam: string;
  victimName: string;
  eventDamage: number;
  attackerPosition: string | null;
}

export interface HeatHealLike {
  matchTime: number;
  healerTeam: string;
  healerName: string;
  healerHero: string;
  eventHealing: number;
  isHealthPack: string;
  healerPosition: string | null;
}

export interface HeatmapInput {
  replay: Pick<Replay, "stages" | "players">;
  sides: Sides;
  rows: { kills: HeatKillLike[]; damage: HeatDamageLike[]; healing: HeatHealLike[] };
  fights: Fight[];
  filter: HeatmapFilter;
}

/** Square cells, HEATMAP_CELLS along the longer axis of the stage's viewBox (image pixels or the 1000-unit plane). */
export function gridFor(stage: StageLike): Grid {
  const width = stage.image?.width ?? PLANE_SIZE;
  const height = stage.image?.height ?? PLANE_SIZE;
  const cell = Math.max(width, height) / HEATMAP_CELLS;
  return { cols: Math.ceil(width / cell), rows: Math.ceil(height / cell), cellW: cell, cellH: cell, width, height };
}

/** World (x, z) to viewBox units through the calibration when present, else the fitted blank plane. */
export function projectorFor(stage: StageLike): (p: { x: number; z: number }) => { px: number; py: number } {
  const affine = stage.image?.affine ?? stage.bounds;
  return (p) => applyAffine(affine, p);
}

/** The cell under a projected point, or null outside the viewBox; the far edge belongs to the last cell. */
export function cellAt(grid: Grid, px: number, py: number): { c: number; r: number } | null {
  if (px < 0 || py < 0 || px > grid.width || py > grid.height) return null;
  return { c: Math.min(grid.cols - 1, Math.floor(px / grid.cellW)), r: Math.min(grid.rows - 1, Math.floor(py / grid.cellH)) };
}

const ground = (raw: string | null | undefined): { x: number; z: number } | null => {
  const p = parsePosition(raw);
  return p ? { x: p.x, z: p.z } : null;
};

export function buildHeatmap(input: HeatmapInput): Heatmap {
  const { replay, sides, rows, fights, filter } = input;
  const stage = replay.stages[filter.stage];
  const grid = gridFor(stage);
  const project = projectorFor(stage);
  const inWindow = (t: number) => windowIndexAt(t, replay.stages) === filter.stage;
  const matches = (team: string, name: string) => {
    if (filter.player) return team === filter.player.team && name === filter.player.name;
    if (filter.side === "both") return true;
    return sideOf(team, sides) === filter.side;
  };
  const marker = (p: { x: number; z: number }, t: number, team: string, name: string, hero: string | undefined, label: string, kind?: KillKind): Marker => {
    const { px, py } = project(p);
    return { px, py, t, team, name, hero: hero ?? "", label, side: sideOf(team, sides), ...(kind ? { kind } : {}) };
  };

  const kills: Marker[] = [];
  const deaths: Marker[] = [];
  for (const k of rows.kills) {
    if (!inWindow(k.matchTime)) continue;
    const kind = killKind(k);
    const a = ground(k.attackerPosition);
    if (kind === "kill" && a && matches(k.attackerTeam, k.attackerName)) kills.push(marker(a, k.matchTime, k.attackerTeam, k.attackerName, k.attackerHero, `${k.attackerName} → ${k.victimName}`, kind));
    const v = ground(k.victimPosition);
    if (v && matches(k.victimTeam, k.victimName)) {
      const label = kind === "kill" ? `${k.victimName} died to ${k.attackerName}` : `${k.victimName} · ${kind}`;
      deaths.push(marker(v, k.matchTime, k.victimTeam, k.victimName, k.victimHero, label, kind));
    }
  }

  const victimsByFight = new Map<number, Array<{ x: number; z: number }>>();
  for (const k of rows.kills) {
    if (!inWindow(k.matchTime)) continue;
    const v = ground(k.victimPosition);
    const f = fights.find((fight) => k.matchTime >= fight.start && k.matchTime <= fight.end);
    if (!v || !f) continue;
    victimsByFight.set(f.index, [...(victimsByFight.get(f.index) ?? []), v]);
  }
  const fightMarkers: Marker[] = [];
  for (const f of fights) {
    const victims = victimsByFight.get(f.index);
    if (!victims) continue;
    const mean = { x: victims.reduce((n, p) => n + p.x, 0) / victims.length, z: victims.reduce((n, p) => n + p.z, 0) / victims.length };
    fightMarkers.push(marker(mean, f.start, f.winner ?? "", "", "", `Fight ${f.index}`));
  }

  const density = buildDensity({ grid, project, inWindow, matches, rows, replay, filter });

  return { grid, points: { kills, deaths, fights: fightMarkers }, density: density.cells, totals: density.totals, routes: buildRoutes({ project, matches, replay, fights, sides, filter }) };
}

/** Steps along a segment every SAMPLE_STEP_SECONDS, interpolating position, and reports each step's start point and length. Returns the seconds walked. */
export function walkSegment(segment: Segment, onStep: (t: number, x: number, z: number, seconds: number) => void): number {
  let walked = 0;
  for (let i = 1; i < segment.samples.length; i += 1) {
    const [t0, x0, z0] = segment.samples[i - 1];
    const [t1, x1, z1] = segment.samples[i];
    const span = t1 - t0;
    if (span <= 0) continue;
    for (let t = t0; t < t1; t += SAMPLE_STEP_SECONDS) {
      const len = Math.min(SAMPLE_STEP_SECONDS, t1 - t);
      const k = (t - t0) / span;
      onStep(t, x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, len);
      walked += len;
    }
  }
  return walked;
}

class CellSum {
  private readonly map = new Map<string, Cell>();
  add(cell: { c: number; r: number } | null, v: number): void {
    if (!cell || v === 0) return;
    const key = `${cell.c},${cell.r}`;
    const cur = this.map.get(key);
    if (cur) cur.v += v;
    else this.map.set(key, { c: cell.c, r: cell.r, v });
  }
  cells(): Cell[] {
    return [...this.map.values()].sort((a, b) => a.r - b.r || a.c - b.c);
  }
}

function buildDensity(ctx: {
  grid: Grid;
  project: (p: { x: number; z: number }) => { px: number; py: number };
  inWindow: (t: number) => boolean;
  matches: (team: string, name: string) => boolean;
  rows: HeatmapInput["rows"];
  replay: HeatmapInput["replay"];
  filter: HeatmapFilter;
}): { cells: Heatmap["density"]; totals: Heatmap["totals"] } {
  const { grid, project, inWindow, matches, rows, replay, filter } = ctx;
  const at = (p: { x: number; z: number }) => {
    const { px, py } = project(p);
    return cellAt(grid, px, py);
  };
  const damage = new CellSum();
  let damageTotal = 0;
  for (const d of rows.damage) {
    if (d.attackerTeam === d.victimTeam || !inWindow(d.matchTime) || !matches(d.attackerTeam, d.attackerName)) continue;
    const p = ground(d.attackerPosition);
    if (!p) continue;
    damage.add(at(p), d.eventDamage);
    damageTotal += d.eventDamage;
  }
  const healing = new CellSum();
  let healingTotal = 0;
  for (const h of rows.healing) {
    if (isFlagSet(h.isHealthPack) || !inWindow(h.matchTime) || !matches(h.healerTeam, h.healerName)) continue;
    const p = ground(h.healerPosition);
    if (!p) continue;
    healing.add(at(p), h.eventHealing);
    healingTotal += h.eventHealing;
  }
  const presence = new CellSum();
  let presenceSeconds = 0;
  for (const pl of replay.players) {
    if (!matches(pl.team, pl.name)) continue;
    for (const seg of pl.segments) {
      if (seg.samples.length === 0 || seg.window !== filter.stage) continue;
      presenceSeconds += walkSegment(seg, (_t, x, z, seconds) => presence.add(at({ x, z }), seconds));
    }
  }
  return { cells: { damage: damage.cells(), healing: healing.cells(), presence: presence.cells() }, totals: { damage: damageTotal, healing: healingTotal, presenceSeconds } };
}

function buildRoutes(ctx: {
  project: (p: { x: number; z: number }) => { px: number; py: number };
  matches: (team: string, name: string) => boolean;
  replay: HeatmapInput["replay"];
  fights: Fight[];
  sides: Sides;
  filter: HeatmapFilter;
}): Route[] {
  const { project, matches, replay, fights, sides, filter } = ctx;
  const routes: Route[] = [];
  for (const pl of replay.players) {
    if (!matches(pl.team, pl.name)) continue;
    for (const seg of pl.segments) {
      if (seg.samples.length === 0 || seg.window !== filter.stage) continue;
      const first = seg.samples[0][0];
      routes.push({
        team: pl.team,
        name: pl.name,
        side: sideOf(pl.team, sides),
        fightIndex: fightIndexAt(first, fights),
        points: seg.samples.map(([t, x, z]) => {
          const { px, py } = project({ x, z });
          return [round1(px), round1(py), t];
        }),
      });
    }
  }
  return routes;
}
