import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { per10 } from "./overview";
import { sides } from "./sides";
import { STAT_KEYS, statValue, type StatKey } from "./stat-keys";
import { finalsByMap, type StatLike, type TeamMapLike } from "./team-rows";

/** Seconds on a hero a row needs to become a point; the profile cards use the same floor. */
export const MIN_POINT_SECONDS = 180;

export interface ScatterPoint {
  scrimId: number;
  scrimName: string;
  scrimDate: string;
  mapId: number;
  mapName: string;
  player: string;
  hero: string;
  role: Role;
  seconds: number;
  per10: Record<StatKey, number>;
}

export interface ScatterPreset { key: string; label: string; x: StatKey; y: StatKey }

export const PRESETS: readonly ScatterPreset[] = [
  { key: "damage-deaths", label: "Hero damage vs deaths", x: "heroDamage", y: "deaths" },
  { key: "blows-deaths", label: "Final blows vs deaths", x: "finalBlows", y: "deaths" },
  { key: "taken-healed", label: "Damage taken vs healing received", x: "damageTaken", y: "healingReceived" },
  { key: "blocked-taken", label: "Damage blocked vs damage taken", x: "damageBlocked", y: "damageTaken" },
];

/** One point per our-side final-round row per (map, player, hero) with MIN_POINT_SECONDS on the hero; map order, then player, then hero. */
export function buildScatterPoints(maps: TeamMapLike[], playerStats: StatLike[]): ScatterPoint[] {
  const finals = finalsByMap(playerStats);
  const out: ScatterPoint[] = [];
  for (const map of maps) {
    const ours = sides(map).ours;
    const rows = (finals.get(map.id) ?? [])
      .filter((r) => r.playerTeam === ours && r.heroTimePlayed >= MIN_POINT_SECONDS)
      .sort((a, b) => a.playerName.localeCompare(b.playerName) || a.playerHero.localeCompare(b.playerHero));
    for (const r of rows) {
      const stats = {} as Record<StatKey, number>;
      for (const k of STAT_KEYS) stats[k] = per10(statValue(r, k), r.heroTimePlayed);
      out.push({
        scrimId: map.scrimId, scrimName: map.scrimName, scrimDate: map.scrimDate, mapId: map.id, mapName: map.mapName,
        player: r.playerName, hero: r.playerHero, role: roleOf(r.playerHero), seconds: r.heroTimePlayed, per10: stats,
      });
    }
  }
  return out;
}

/** Distinct heroes among the points, by role then name. */
export function heroesOf(points: ScatterPoint[]): string[] {
  return [...new Set(points.map((p) => p.hero))].sort((a, b) => ROLE_ORDER.indexOf(roleOf(a)) - ROLE_ORDER.indexOf(roleOf(b)) || a.localeCompare(b));
}
