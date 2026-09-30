import { fightIndexAt, groupFights, type KillLike } from "./fights";
import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { per10 } from "./overview";
import { sides } from "./sides";
import { finalsByMap, groupByMap, outcome, rate, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";
import { keptCasts } from "./ult-analysis";
import type { UltLike } from "./ultimates";

/** Decided plays a trio needs before it is ranked; the same floor as MIN_MAP_PLAYS. */
export const MIN_TRIO_PLAYS = 3;
export const TRIO_LIMIT = 5;

export type KillRowLike = KillLike & MapKeyed;
export type UltRowLike = UltLike & MapKeyed;

export interface RoleCard {
  role: Role;
  playtime: number;
  maps: number;
  kd: number | null;
  damagePer10: number;
  healingPer10: number;
  deathsPer10: number;
  ultEfficiency: number | null;
  casts: number;
}

export interface TrioRow {
  tank: string;
  damage: string;
  support: string;
  played: number;
  won: number;
  lost: number;
  winRate: number | null;
}

export interface Performance {
  roles: RoleCard[];
  trios: TrioRow[];
}

/** Each player's main role on one map: the role with the most hero time; ties go to the earlier role in ROLE_ORDER. */
export function mainRoles(rows: StatLike[]): Map<string, Role> {
  const byPlayer = new Map<string, Map<Role, number>>();
  for (const r of rows) {
    if (r.heroTimePlayed <= 0) continue;
    const roles = byPlayer.get(r.playerName) ?? new Map<Role, number>();
    const role = roleOf(r.playerHero);
    roles.set(role, (roles.get(role) ?? 0) + r.heroTimePlayed);
    byPlayer.set(r.playerName, roles);
  }
  const out = new Map<string, Role>();
  for (const [name, roles] of byPlayer) {
    out.set(name, ROLE_ORDER.reduce((best, role) => ((roles.get(role) ?? 0) > (roles.get(best) ?? 0) ? role : best), ROLE_ORDER[0]));
  }
  return out;
}

interface RoleAcc {
  playtime: number;
  maps: Set<number>;
  finalBlows: number;
  deaths: number;
  heroDamage: number;
  healing: number;
  casts: number;
  castsWon: number;
}

const emptyAcc = (): RoleAcc => ({ playtime: 0, maps: new Set(), finalBlows: 0, deaths: 0, heroDamage: 0, healing: 0, casts: 0, castsWon: 0 });

interface TrioAcc {
  tank: string;
  damage: string;
  support: string;
  played: number;
  won: number;
  lost: number;
}

/** Per-role cards and the best tank/damage/support player trios over our side's maps in range. */
export function buildPerformance(maps: TeamMapLike[], playerStats: StatLike[], kills: KillRowLike[], ultStarts: UltRowLike[], ultEnds: UltRowLike[]): Performance {
  const finals = finalsByMap(playerStats);
  const killsByMap = groupByMap(kills);
  const startsByMap = groupByMap(ultStarts);
  const endsByMap = groupByMap(ultEnds);
  const roles = new Map<Role, RoleAcc>();
  const trios = new Map<string, TrioAcc>();

  for (const map of maps) {
    const ours = sides(map).ours;
    const ourRows = (finals.get(map.id) ?? []).filter((r) => r.playerTeam === ours && r.heroTimePlayed > 0);
    const main = mainRoles(ourRows);

    for (const r of ourRows) {
      const role = main.get(r.playerName) ?? roleOf(r.playerHero);
      const acc = roles.get(role) ?? emptyAcc();
      acc.playtime += r.heroTimePlayed;
      acc.maps.add(map.id);
      acc.finalBlows += r.finalBlows;
      acc.deaths += r.deaths;
      acc.heroDamage += r.heroDamageDealt;
      acc.healing += r.healingDealt;
      roles.set(role, acc);
    }

    const fights = groupFights(killsByMap.get(map.id) ?? []);
    for (const cast of keptCasts(startsByMap.get(map.id) ?? [], endsByMap.get(map.id) ?? [])) {
      if (cast.team !== ours) continue;
      const acc = roles.get(roleOf(cast.hero)) ?? emptyAcc();
      acc.casts += 1;
      const index = fightIndexAt(cast.time, fights);
      if (index !== null && fights.find((f) => f.index === index)?.winner === ours) acc.castsWon += 1;
      roles.set(roleOf(cast.hero), acc);
    }

    const byRole = (role: Role) => [...main].filter(([, r]) => r === role).map(([name]) => name).sort();
    const result = outcome(map);
    for (const tank of byRole("Tank")) {
      for (const damage of byRole("Damage")) {
        for (const support of byRole("Support")) {
          const key = `${tank}|${damage}|${support}`;
          const t = trios.get(key) ?? { tank, damage, support, played: 0, won: 0, lost: 0 };
          t.played += 1;
          if (result !== "undecided") t[result] += 1;
          trios.set(key, t);
        }
      }
    }
  }

  const cards: RoleCard[] = ROLE_ORDER.filter((role) => (roles.get(role)?.playtime ?? 0) > 0).map((role) => {
    const a = roles.get(role)!;
    return {
      role,
      playtime: a.playtime,
      maps: a.maps.size,
      kd: a.deaths === 0 ? null : a.finalBlows / a.deaths,
      damagePer10: per10(a.heroDamage, a.playtime),
      healingPer10: per10(a.healing, a.playtime),
      deathsPer10: per10(a.deaths, a.playtime),
      ultEfficiency: rate(a.castsWon, a.casts),
      casts: a.casts,
    };
  });

  const ranked: TrioRow[] = [...trios.values()]
    .filter((t) => t.won + t.lost >= MIN_TRIO_PLAYS)
    .map((t) => ({ ...t, winRate: rate(t.won, t.won + t.lost) }))
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || b.played - a.played || a.tank.localeCompare(b.tank) || a.damage.localeCompare(b.damage) || a.support.localeCompare(b.support))
    .slice(0, TRIO_LIMIT);

  return { roles: cards, trios: ranked };
}
