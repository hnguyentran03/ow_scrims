import { readFileSync } from "node:fs";
import type { KillLike } from "@/lib/stats/fights";
import type { MapKeyed, StatLike, TeamMapLike } from "@/lib/stats/team-rows";
import type { UltLike } from "@/lib/stats/ultimates";
import type { EventRow } from "@/lib/parser/events";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

/** Ult and kill rows of a sample log, shaped like the stats modules' inputs. */
export const sampleRows = (name: string) => {
  const ev = parseLog(readFileSync(`test/samples/${name}.txt`, "utf8")).events;
  return {
    starts: (ev.ultimate_start ?? []) as unknown as UltLike[],
    ends: (ev.ultimate_end ?? []) as unknown as UltLike[],
    charged: (ev.ultimate_charged ?? []) as unknown as UltLike[],
    kills: (ev.kill ?? []) as unknown as KillLike[],
  };
};

export interface SampleAbility extends MapKeyed { matchTime: number; playerTeam: string; playerName: string; playerHero: string; slot: 1 | 2 }
export interface SampleRound extends MapKeyed { matchTime: number; roundNumber: number }

/** A sample log as one team-page map: every row tagged with `mapId`, the map row from deriveMapMeta. */
export const sampleMapRows = (name: string, id: number, ourSide: number) => {
  const parsed = parseLog(readFileSync(`test/samples/${name}.txt`, "utf8"));
  const meta = deriveMapMeta(parsed);
  const tag = <T>(rows: EventRow[] | undefined): T[] => (rows ?? []).map((r) => ({ ...r, mapId: id })) as unknown as T[];
  const slotted = (rows: EventRow[] | undefined, slot: 1 | 2): SampleAbility[] => (rows ?? []).map((r) => ({ ...r, mapId: id, slot })) as unknown as SampleAbility[];
  const map: TeamMapLike = { id, scrimId: id, scrimName: name, scrimDate: "2026-09-18", mapName: meta.mapName, mapType: meta.mapType, team1Name: meta.team1Name, team2Name: meta.team2Name, ourSide, winnerSide: meta.winnerSide, durationSeconds: meta.durationSeconds };
  return {
    map,
    kills: tag<KillLike & MapKeyed>(parsed.events.kill),
    starts: tag<UltLike & MapKeyed>(parsed.events.ultimate_start),
    ends: tag<UltLike & MapKeyed>(parsed.events.ultimate_end),
    playerStats: tag<StatLike>(parsed.events.player_stat),
    abilities: [...slotted(parsed.events.ability_1_used, 1), ...slotted(parsed.events.ability_2_used, 2)].sort((a, b) => a.matchTime - b.matchTime || a.slot - b.slot),
    roundStarts: tag<SampleRound>(parsed.events.round_start),
  };
};
