import { parseCalibration } from "./calibration";
import type { Fight } from "./fights";
import { cellAt, gridFor, projectorFor, walkSegment, type Grid } from "./heatmap";
import { positionAt } from "./playback";
import type { Replay } from "./replay";
import type { SideKey } from "./sides";
import { SAMPLE_STEP_SECONDS } from "./tracks";

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

type Instant = "ours" | "theirs" | "contested";

function share(instants: Instant[]): Share {
  const n = instants.length;
  if (n === 0) return { ours: 0, theirs: 0, contested: 0 };
  const count = (k: Instant) => instants.filter((i) => i === k).length / n;
  return { ours: count("ours"), theirs: count("theirs"), contested: count("contested") };
}

function buildObjective(input: TerritoryInput): NonNullable<Territory["objective"]> {
  const window = input.replay.stages[input.stage];
  const centre = input.objective as { x: number; z: number };
  const players = sidedPlayersInWindow(input);
  const oursTeam = input.replay.players.find((p) => p.side === "ours")?.team ?? null;
  const theirsTeam = input.replay.players.find((p) => p.side === "theirs")?.team ?? null;
  const observed: Array<{ t: number; state: Instant }> = [];
  for (let t = window.start; t <= window.end + 1e-9; t += SAMPLE_STEP_SECONDS) {
    let ours = 0;
    let theirs = 0;
    for (const { player, segments } of players) {
      const p = positionAt(segments, t);
      if (!p) continue;
      if (Math.hypot(p.x - centre.x, p.z - centre.z) <= OBJECTIVE_RADIUS_METERS) {
        if (player.side === "ours") ours += 1;
        else theirs += 1;
      }
    }
    if (ours === 0 && theirs === 0) continue;
    observed.push({ t, state: ours > theirs ? "ours" : theirs > ours ? "theirs" : "contested" });
  }
  const byFight = input.fights
    .filter((f) => f.end >= window.start && f.start <= window.end)
    .map((f) => ({
      index: f.index,
      winner: (f.winner === null ? null : f.winner === oursTeam ? "ours" : f.winner === theirsTeam ? "theirs" : null) as SideKey | null,
      share: share(observed.filter((o) => o.t >= f.start && o.t <= f.end).map((o) => o.state)),
    }));
  return { stage: share(observed.map((o) => o.state)), byFight, observedSeconds: observed.length * SAMPLE_STEP_SECONDS };
}

/** The objective centre stored by the phase 7 calibration page, or null when absent or malformed; `parseCalibration` already validates the JSON. */
export function objectiveFromCalibration(calibration: string | null): { x: number; z: number } | null {
  return parseCalibration(calibration)?.objective ?? null;
}
