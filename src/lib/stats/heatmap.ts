import type { HeatmapFilter } from "@/lib/heatmap-filters";
import { applyAffine, PLANE_SIZE } from "./calibration";
import { killKind, type Fight, type KillKind } from "./fights";
import { parsePosition } from "./positions";
import type { Replay } from "./replay";
import { sideOf, type SideKey, type Sides } from "./sides";
import { windowIndexAt } from "./stages";

export const HEATMAP_CELLS = 40;

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

  return { grid, points: { kills, deaths, fights: fightMarkers }, density: density.cells, totals: density.totals, routes: buildRoutes({ project, inWindow, matches, replay, fights, sides }) };
}

function buildDensity(_: unknown): { cells: Heatmap["density"]; totals: Heatmap["totals"] } {
  return { cells: { damage: [], healing: [], presence: [] }, totals: { damage: 0, healing: 0, presenceSeconds: 0 } };
}

function buildRoutes(_: unknown): Route[] {
  return [];
}
