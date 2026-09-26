import { findAjaxes } from "./events";
import type { KillLike } from "./fights";
import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { per10 } from "./overview";
import { sides } from "./sides";
import { finalsByMap, groupByMap, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";
import { heroPicks } from "./trends";
import type { UltLike } from "./ultimates";

/** Minimum time in range before a player can appear on a board. */
export const LEADERBOARD_MIN_SECONDS = 600;
export const LEADERBOARD_SIZE = 3;

export interface RosterRow {
  name: string;
  maps: number;
  timePlayed: number;
  mainRole: Role;
  topHero: string;
}

export type BoardKey = "eliminations" | "heroDamage" | "healing" | "damageBlocked" | "deaths" | "timePlayed" | "ajaxes";

export interface BoardEntry {
  name: string;
  value: number;
}

export interface Board {
  key: BoardKey;
  label: string;
  unit: "per10" | "seconds" | "count";
  entries: BoardEntry[];
}

export interface Leaderboard {
  boards: Board[];
  mostPlayedHeroes: Array<{ hero: string; role: Role; playtime: number }>;
  eligibleCount: number;
  minSeconds: number;
}

interface Totals {
  name: string;
  maps: Set<number>;
  time: number;
  byHero: Map<string, number>;
  elims: number;
  heroDamage: number;
  healing: number;
  blocked: number;
  deaths: number;
}

/** Per-player sums over our side's final rows, keyed by name in first-seen order (scrim date, map order, log order). */
function totals(maps: TeamMapLike[], playerStats: StatLike[]): Map<string, Totals> {
  const finals = finalsByMap(playerStats);
  const out = new Map<string, Totals>();
  for (const map of maps) {
    const ours = sides(map).ours;
    for (const r of finals.get(map.id) ?? []) {
      if (r.playerTeam !== ours || r.heroTimePlayed <= 0) continue;
      const t = out.get(r.playerName) ?? { name: r.playerName, maps: new Set<number>(), time: 0, byHero: new Map<string, number>(), elims: 0, heroDamage: 0, healing: 0, blocked: 0, deaths: 0 };
      t.maps.add(map.id);
      t.time += r.heroTimePlayed;
      t.byHero.set(r.playerHero, (t.byHero.get(r.playerHero) ?? 0) + r.heroTimePlayed);
      t.elims += r.eliminations;
      t.heroDamage += r.heroDamageDealt;
      t.healing += r.healingDealt;
      t.blocked += r.damageBlocked;
      t.deaths += r.deaths;
      out.set(r.playerName, t);
    }
  }
  return out;
}

function topHero(byHero: Map<string, number>): string {
  let best = "";
  let bestTime = -1;
  for (const [hero, time] of byHero) {
    if (time > bestTime) {
      best = hero;
      bestTime = time;
    }
  }
  return best;
}

/** Role with the most playtime; ties go to the earlier role in ROLE_ORDER. */
function mainRole(byHero: Map<string, number>): Role {
  const byRole = new Map<Role, number>();
  for (const [hero, time] of byHero) byRole.set(roleOf(hero), (byRole.get(roleOf(hero)) ?? 0) + time);
  return ROLE_ORDER.reduce((best, role) => ((byRole.get(role) ?? 0) > (byRole.get(best) ?? 0) ? role : best), ROLE_ORDER[0]);
}

export function buildRoster(maps: TeamMapLike[], playerStats: StatLike[]): RosterRow[] {
  return [...totals(maps, playerStats).values()]
    .map((t) => ({ name: t.name, maps: t.maps.size, timePlayed: t.time, mainRole: mainRole(t.byHero), topHero: topHero(t.byHero) }))
    .sort((a, b) => b.timePlayed - a.timePlayed || a.name.localeCompare(b.name));
}

/** Ajaxes per player on our side across the maps. */
function ajaxCounts(maps: TeamMapLike[], kills: (KillLike & MapKeyed)[], ultEnds: (UltLike & MapKeyed)[]): Map<string, number> {
  const killsBy = groupByMap(kills);
  const endsBy = groupByMap(ultEnds);
  const out = new Map<string, number>();
  for (const map of maps) {
    const ours = sides(map).ours;
    for (const a of findAjaxes(killsBy.get(map.id) ?? [], endsBy.get(map.id) ?? [])) {
      if (a.team !== ours) continue;
      out.set(a.player, (out.get(a.player) ?? 0) + 1);
    }
  }
  return out;
}

export function buildLeaderboard(maps: TeamMapLike[], playerStats: StatLike[], kills: (KillLike & MapKeyed)[], ultEnds: (UltLike & MapKeyed)[]): Leaderboard {
  const eligible = [...totals(maps, playerStats).values()].filter((t) => t.time >= LEADERBOARD_MIN_SECONDS);
  const ajaxes = ajaxCounts(maps, kills, ultEnds);
  // Array.sort is stable, so ties keep first-seen order.
  const board = (key: BoardKey, label: string, unit: Board["unit"], value: (t: Totals) => number, order: "desc" | "asc" = "desc", keep: (v: number) => boolean = () => true): Board => ({
    key, label, unit,
    entries: eligible
      .map((t) => ({ name: t.name, value: value(t) }))
      .filter((e) => keep(e.value))
      .sort((a, b) => (order === "desc" ? b.value - a.value : a.value - b.value))
      .slice(0, LEADERBOARD_SIZE),
  });
  return {
    boards: [
      board("eliminations", "Eliminations per 10", "per10", (t) => per10(t.elims, t.time)),
      board("heroDamage", "Hero damage per 10", "per10", (t) => per10(t.heroDamage, t.time)),
      board("healing", "Healing per 10", "per10", (t) => per10(t.healing, t.time)),
      board("damageBlocked", "Damage blocked per 10", "per10", (t) => per10(t.blocked, t.time)),
      board("deaths", "Fewest deaths per 10", "per10", (t) => per10(t.deaths, t.time), "asc"),
      board("timePlayed", "Time played", "seconds", (t) => t.time),
      board("ajaxes", "Ajaxes", "count", (t) => ajaxes.get(t.name) ?? 0, "desc", (v) => v > 0),
    ],
    mostPlayedHeroes: heroPicks(maps, playerStats, [], "ours")
      .sort((a, b) => b.playtime - a.playtime || a.hero.localeCompare(b.hero))
      .slice(0, LEADERBOARD_SIZE)
      .map(({ hero, role, playtime }) => ({ hero, role, playtime })),
    eligibleCount: eligible.length,
    minSeconds: LEADERBOARD_MIN_SECONDS,
  };
}
