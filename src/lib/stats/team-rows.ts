import { finalRoundRows, type PlayerStatLike } from "./overview";
import { sides } from "./sides";

/** A map row joined with its scrim, as returned by getTeamRows. */
export interface TeamMapLike {
  id: number;
  scrimId: number;
  scrimName: string;
  scrimDate: string;
  mapName: string;
  mapType: string;
  team1Name: string;
  team2Name: string;
  ourSide: number;
  winnerSide: number | null;
  durationSeconds: number;
}

export interface MapKeyed {
  mapId: number;
}

export type StatLike = PlayerStatLike & MapKeyed;

export function groupByMap<T extends MapKeyed>(rows: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const row of rows) {
    const list = out.get(row.mapId) ?? [];
    list.push(row);
    out.set(row.mapId, list);
  }
  return out;
}

/** Final-round player_stat rows per map. finalRoundRows keys by team, player, and hero only, so group by map first. */
export function finalsByMap<T extends StatLike>(rows: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const [mapId, list] of groupByMap(rows)) out.set(mapId, finalRoundRows(list));
  return out;
}

export function outcome(map: { ourSide: number; winnerSide: number | null }): "won" | "lost" | "undecided" {
  if (map.winnerSide === null) return "undecided";
  return map.winnerSide === map.ourSide ? "won" : "lost";
}

/** n / d, or null when d is 0, so every rate can be shown as "–" instead of a fake 0%. */
export function rate(n: number, d: number): number | null {
  return d === 0 ? null : n / d;
}

/** Final rows for `name` on our side with time on the hero, per map in map order; `hero` null means every hero. */
export function ourRowsByMap(maps: TeamMapLike[], playerStats: StatLike[], name: string, hero: string | null): Map<number, StatLike[]> {
  const finals = finalsByMap(playerStats);
  const out = new Map<number, StatLike[]>();
  for (const map of maps) {
    const ours = sides(map).ours;
    const rows = (finals.get(map.id) ?? []).filter((r) => r.playerTeam === ours && r.playerName === name && r.heroTimePlayed > 0 && (hero === null || r.playerHero === hero));
    if (rows.length > 0) out.set(map.id, rows);
  }
  return out;
}
