import type { Replay, ReplayKill, ReplayPlayer, ReplayStage } from "./stats/replay";
import { windowLabel, type StageWindow } from "./stats/stages";

export interface GhostOption {
  mapId: number;
  window: number;
  label: string;
}

export interface Ghost {
  label: string;
  start: number;
  end: number;
  firstKill: number | null;
  players: ReplayPlayer[];
  kills: ReplayKill[];
}

/** Every window sharing the current window's stage: this map's other rounds first, then other maps of the same base name. */
export function ghostOptions(
  current: { mapId: number; stages: ReplayStage[]; windowIndex: number },
  others: Array<{ mapId: number; scrimName: string; scrimDate: string; stages: StageWindow[]; map: { mapName: string; mapType: string } }>,
  ownLabel: { scrimName: string; scrimDate: string },
): GhostOption[] {
  const stage = current.stages[current.windowIndex]?.stage;
  if (stage === undefined) return [];
  const out: GhostOption[] = [];
  current.stages.forEach((s, i) => {
    if (i !== current.windowIndex && s.stage === stage) out.push({ mapId: current.mapId, window: i, label: `${ownLabel.scrimName} · ${ownLabel.scrimDate} · ${s.label}` });
  });
  for (const o of others) {
    o.stages.forEach((w, i) => {
      if (w.stage === stage) out.push({ mapId: o.mapId, window: i, label: `${o.scrimName} · ${o.scrimDate} · ${windowLabel(o.map, w)}` });
    });
  }
  return out;
}

/** The parts of a replay that the ghost overlay draws, cut to one window and re-tagged to the viewer's window index. */
export function ghostFrom(replay: Replay, window: number, targetWindow: number, label: string): Ghost | null {
  const w = replay.stages[window];
  if (!w) return null;
  const kills = replay.kills.filter((k) => k.t >= w.start && k.t <= w.end);
  return {
    label,
    start: w.start,
    end: w.end,
    firstKill: kills[0]?.t ?? null,
    players: replay.players.map((p) => ({ ...p, segments: p.segments.filter((s) => s.window === window).map((s) => ({ ...s, window: targetWindow })) })),
    kills,
  };
}
