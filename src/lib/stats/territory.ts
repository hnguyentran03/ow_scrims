import type { Fight } from "./fights";
import { cellAt, gridFor, projectorFor, walkSegment, type Grid } from "./heatmap";
import type { Replay } from "./replay";
import type { SideKey } from "./sides";

export const TERRITORY_MAJORITY = 0.6;
export const OBJECTIVE_RADIUS_METERS = 10;

export type Owner = "ours" | "theirs" | "contested";

/** Fractions of observed time; they sum to 1. */
export interface Share {
  ours: number;
  theirs: number;
  contested: number;
}

export interface Territory {
  cells: Array<{ c: number; r: number; owner: Owner; seconds: number }>;
  objective: {
    stage: Share;
    byFight: Array<{ index: number; winner: SideKey | null; share: Share }>;
    observedSeconds: number;
  } | null;
}

export interface TerritoryInput {
  replay: Pick<Replay, "stages" | "players">;
  /** Index into replay.stages. */
  stage: number;
  fights: Fight[];
  objective: { x: number; z: number } | null;
}

type SidePlayer = Replay["players"][number] & { side: SideKey };

function sidedPlayersInWindow(input: TerritoryInput): Array<{ player: SidePlayer; segments: SidePlayer["segments"] }> {
  const { replay, stage } = input;
  const out: Array<{ player: SidePlayer; segments: SidePlayer["segments"] }> = [];
  for (const p of replay.players) {
    if (p.side !== "ours" && p.side !== "theirs") continue;
    const segments = p.segments.filter((s) => s.samples.length > 0 && s.window === stage);
    if (segments.length > 0) out.push({ player: p as SidePlayer, segments });
  }
  return out;
}

function ownerOf(ours: number, theirs: number): Owner {
  const total = ours + theirs;
  if (ours / total >= TERRITORY_MAJORITY) return "ours";
  if (theirs / total >= TERRITORY_MAJORITY) return "theirs";
  return "contested";
}

function buildCells(input: TerritoryInput, grid: Grid): Territory["cells"] {
  const project = projectorFor(input.replay.stages[input.stage]);
  const sums = new Map<string, { c: number; r: number; ours: number; theirs: number }>();
  for (const { player, segments } of sidedPlayersInWindow(input)) {
    for (const seg of segments) {
      walkSegment(seg, (_t, x, z, seconds) => {
        const { px, py } = project({ x, z });
        const cell = cellAt(grid, px, py);
        if (!cell) return;
        const key = `${cell.c},${cell.r}`;
        const cur = sums.get(key) ?? { c: cell.c, r: cell.r, ours: 0, theirs: 0 };
        cur[player.side] += seconds;
        sums.set(key, cur);
      });
    }
  }
  return [...sums.values()]
    .sort((a, b) => a.r - b.r || a.c - b.c)
    .map((s) => ({ c: s.c, r: s.r, owner: ownerOf(s.ours, s.theirs), seconds: s.ours + s.theirs }));
}

export function buildTerritory(input: TerritoryInput): Territory {
  const grid = gridFor(input.replay.stages[input.stage]);
  return { cells: buildCells(input, grid), objective: input.objective ? buildObjective(input) : null };
}

function buildObjective(_input: TerritoryInput): NonNullable<Territory["objective"]> {
  void _input;
  return { stage: { ours: 0, theirs: 0, contested: 0 }, byFight: [], observedSeconds: 0 };
}

export function objectiveFromCalibration(_calibration: string | null): { x: number; z: number } | null {
  void _calibration;
  return null;
}
