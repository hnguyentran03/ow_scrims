import { dedupeRounds, type RoundLike } from "./rounds";

export interface StageWindow {
  /** Which image and calibration this window uses: Control objective index, Flashpoint point index, 0 elsewhere. */
  stage: number;
  roundNumber: number;
  start: number;
  end: number;
}

export interface RoundStartLike extends RoundLike {
  objectiveIndex: number;
}

export interface ObjectiveUpdateLike {
  matchTime: number;
  currentObjectiveIndex: number;
}

export interface StageInput {
  mapType: string;
  roundStarts: RoundStartLike[];
  roundEnds: RoundLike[];
  objectiveUpdated: ObjectiveUpdateLike[];
  durationSeconds: number;
}

const STAGED_MODES = new Set(["Control", "Flashpoint"]);

/**
 * One playback window per deduped round on every mode. Control takes the round's objective index as
 * its stage, Flashpoint splits the round further at every objective_updated row, and every other mode
 * is stage 0 (Escort and Hybrid checkpoints step the objective index but stay on one map image).
 */
export function stageWindows(input: StageInput): StageWindow[] {
  const starts = dedupeRounds(input.roundStarts);
  const ends = dedupeRounds(input.roundEnds);
  if (starts.length === 0) return [{ stage: 0, roundNumber: 1, start: 0, end: input.durationSeconds }];
  const staged = STAGED_MODES.has(input.mapType);
  const updates = [...input.objectiveUpdated].sort((a, b) => a.matchTime - b.matchTime);
  const out: StageWindow[] = [];
  starts.forEach((rs, i) => {
    const nextStart = starts[i + 1]?.matchTime;
    const end =
      ends.find((re) => re.matchTime > rs.matchTime && (nextStart === undefined || re.matchTime <= nextStart))?.matchTime ??
      nextStart ??
      input.durationSeconds;
    let stage = staged ? rs.objectiveIndex : 0;
    let cursor = rs.matchTime;
    if (input.mapType === "Flashpoint") {
      for (const u of updates) {
        if (u.matchTime <= rs.matchTime || u.matchTime >= end) continue;
        out.push({ stage, roundNumber: rs.roundNumber, start: cursor, end: u.matchTime });
        cursor = u.matchTime;
        stage = u.currentObjectiveIndex;
      }
    }
    out.push({ stage, roundNumber: rs.roundNumber, start: cursor, end });
  });
  return out;
}

/** The window owning `t`: the containing one, else the next to start (setup gaps belong to the later round), else the last. */
export function windowIndexAt(t: number, windows: StageWindow[]): number {
  const inside = windows.findIndex((w) => t >= w.start && t <= w.end);
  if (inside >= 0) return inside;
  const next = windows.findIndex((w) => w.start > t);
  return next >= 0 ? next : windows.length - 1;
}

/**
 * Hand-authored stage names per base map name, indexed by stage (Control objective index, Flashpoint point index).
 * The order of names per index is not in the log data: fill a map in only after seeing its calibrated image on the
 * Replay tab and confirming which round played on which stage. Unfilled maps read "Stage n".
 * In-game names for reference — Busan: Downtown, Sanctuary, MEKA Base · Ilios: Lighthouse, Well, Ruins ·
 * Lijiang Tower: Night Market, Garden, Control Center · Nepal: Village, Shrine, Sanctum ·
 * Oasis: City Center, Gardens, University · Antarctic Peninsula: Icebreaker, Labs, Sublevel ·
 * Samoa: Beach, Downtown, Volcano · Aatlis, New Junk City, Suravasa: five Flashpoint points each.
 */
export const STAGE_NAMES: Record<string, string[]> = {};

export function stageLabel(map: { mapName: string; mapType: string }, stage: number): string {
  if (!STAGED_MODES.has(map.mapType)) return "Map";
  // An empty string marks an index whose name has not been confirmed yet.
  return STAGE_NAMES[map.mapName]?.[stage] || `Stage ${stage}`;
}

export function windowLabel(map: { mapName: string; mapType: string }, w: StageWindow): string {
  const round = `Round ${w.roundNumber}`;
  return STAGED_MODES.has(map.mapType) ? `${stageLabel(map, w.stage)} · ${round}` : round;
}
