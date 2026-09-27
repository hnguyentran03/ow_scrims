import { readFileSync } from "node:fs";
import type { MapRow, ReplayRows } from "@/lib/db/queries";
import { deriveMapMeta } from "@/lib/parser/derive";
import { parseLog } from "@/lib/parser/parse";

/** A sample log as the row set getReplayRows would return, plus a MapRow-shaped map. Types are asserted, not checked: the parser rows lack id/mapId. */
export function replayRowsFromLog(name: string, ourSide: 1 | 2 = 1): { map: MapRow; rows: ReplayRows } {
  const parsed = parseLog(readFileSync(`test/samples/${name}.txt`, "utf8"));
  const ev = parsed.events;
  const rows = {
    kills: ev.kill ?? [], rezzes: ev.mercy_rez ?? [], damage: ev.damage ?? [], healing: ev.healing ?? [],
    ability1: ev.ability_1_used ?? [], ability2: ev.ability_2_used ?? [], ultStarts: ev.ultimate_start ?? [], ultEnds: ev.ultimate_end ?? [],
    ultCharged: ev.ultimate_charged ?? [], heroSwaps: ev.hero_swap ?? [], swaps: ev.hero_swap ?? [], heroSpawns: ev.hero_spawn ?? [], matchStarts: ev.match_start ?? [],
    matchEnds: ev.match_end ?? [], roundStarts: ev.round_start ?? [], roundEnds: ev.round_end ?? [], captures: ev.objective_captured ?? [],
    objectiveUpdated: ev.objective_updated ?? [], playerStats: ev.player_stat ?? [],
  } as unknown as ReplayRows;
  const meta = deriveMapMeta(parsed);
  const map = { id: 1, scrimId: 1, order: 1, ...meta, ourSide, winnerSide: null, winnerSource: null, rawLogPath: null, originalFilename: `${name}.txt`, uploadedAt: new Date() } as unknown as MapRow;
  return { map, rows };
}
