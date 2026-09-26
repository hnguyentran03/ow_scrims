import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { sides } from "./sides";
import { finalsByMap, type StatLike, type TeamMapLike } from "./team-rows";

export interface RosterRow {
  name: string;
  maps: number;
  timePlayed: number;
  mainRole: Role;
  topHero: string;
}

interface Totals {
  name: string;
  maps: Set<number>;
  time: number;
  byHero: Map<string, number>;
}

/** Per-player playtime over our side's final rows, keyed by name in first-seen order (scrim date, map order, log order). */
function totals(maps: TeamMapLike[], playerStats: StatLike[]): Map<string, Totals> {
  const finals = finalsByMap(playerStats);
  const out = new Map<string, Totals>();
  for (const map of maps) {
    const ours = sides(map).ours;
    for (const r of finals.get(map.id) ?? []) {
      if (r.playerTeam !== ours || r.heroTimePlayed <= 0) continue;
      const t = out.get(r.playerName) ?? { name: r.playerName, maps: new Set<number>(), time: 0, byHero: new Map<string, number>() };
      t.maps.add(map.id);
      t.time += r.heroTimePlayed;
      t.byHero.set(r.playerHero, (t.byHero.get(r.playerHero) ?? 0) + r.heroTimePlayed);
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

/** Every player with hero time on our side in range, most time first, then by name. */
export function buildRoster(maps: TeamMapLike[], playerStats: StatLike[]): RosterRow[] {
  return [...totals(maps, playerStats).values()]
    .map((t) => ({ name: t.name, maps: t.maps.size, timePlayed: t.time, mainRole: mainRole(t.byHero), topHero: topHero(t.byHero) }))
    .sort((a, b) => b.timePlayed - a.timePlayed || a.name.localeCompare(b.name));
}
