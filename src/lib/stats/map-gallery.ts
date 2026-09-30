import { outcome, type TeamMapLike } from "./team-rows";
import { winRateByMap, type MapRecord } from "./trends";

export type Outcome = "won" | "lost" | "undecided";
export const RECENT_LIMIT = 5;

export interface MapTile extends MapRecord {
  /** The last RECENT_LIMIT outcomes in play order, oldest first. */
  recent: Outcome[];
  lastPlayed: string;
}

/** One tile per map in the trends table's order, with its recent form and the date it was last played. */
export function mapGallery(maps: TeamMapLike[]): MapTile[] {
  const outcomes = new Map<string, Outcome[]>();
  const last = new Map<string, string>();
  for (const m of maps) {
    outcomes.set(m.mapName, [...(outcomes.get(m.mapName) ?? []), outcome(m)]);
    last.set(m.mapName, m.scrimDate);
  }
  return winRateByMap(maps).map((r) => ({ ...r, recent: (outcomes.get(r.mapName) ?? []).slice(-RECENT_LIMIT), lastPlayed: last.get(r.mapName) ?? "" }));
}
