import type { Replay } from "@/lib/stats/replay";
import type { SideKey } from "@/lib/stats/sides";

export type FilterSide = SideKey | "both";

export interface HeatmapFilter {
  /** Index into `replay.stages` (one window per round). */
  stage: number;
  side: FilterSide;
  player: { team: string; name: string; side: SideKey | null } | null;
}

type Params = Record<string, string | string[] | undefined>;

export const playerKey = (p: { team: string; name: string }): string => `${p.team}|${p.name}`;

const SIDES: FilterSide[] = ["ours", "theirs", "both"];

/** Reads ?stage=&side=&player= with the same drop-silently rule as parseRange; a player implies their side. */
export function parseHeatmapFilters(params: Params, replay: Pick<Replay, "stages" | "players">): HeatmapFilter {
  const rawStage = typeof params.stage === "string" ? params.stage : "";
  const stage = /^\d+$/.test(rawStage) && Number(rawStage) < replay.stages.length ? Number(rawStage) : 0;
  const rawSide = typeof params.side === "string" ? params.side : "";
  let side: FilterSide = (SIDES as string[]).includes(rawSide) ? (rawSide as FilterSide) : "both";
  const rawPlayer = typeof params.player === "string" ? params.player : "";
  const found = replay.players.find((p) => playerKey(p) === rawPlayer);
  const player = found ? { team: found.team, name: found.name, side: found.side } : null;
  if (player?.side) side = player.side;
  return { stage, side, player };
}
