import { fightIndexAt, type Fight, type KillLike } from "./fights";
import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { per10 } from "./overview";
import { sides } from "./sides";
import { finalsByMap, groupByMap, rate, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";
import { keptCasts } from "./ult-analysis";
import type { UltLike } from "./ultimates";

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

export interface Performance {
  roles: RoleCard[];
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

/** Per-role cards over our side's maps in range. */
export function buildPerformance(maps: TeamMapLike[], playerStats: StatLike[], fightsOf: Map<number, Fight[]>, ultStarts: UltRowLike[], ultEnds: UltRowLike[]): Performance {
  const finals = finalsByMap(playerStats);
  const startsByMap = groupByMap(ultStarts);
  const endsByMap = groupByMap(ultEnds);
  const roles = new Map<Role, RoleAcc>();

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

    const fights = fightsOf.get(map.id) ?? [];
    for (const cast of keptCasts(startsByMap.get(map.id) ?? [], endsByMap.get(map.id) ?? [])) {
      if (cast.team !== ours) continue;
      const role = main.get(cast.player) ?? roleOf(cast.hero);
      const acc = roles.get(role) ?? emptyAcc();
      acc.casts += 1;
      const index = fightIndexAt(cast.time, fights);
      if (index !== null && fights.find((f) => f.index === index)?.winner === ours) acc.castsWon += 1;
      roles.set(role, acc);
    }
  }

  const cards: RoleCard[] = ROLE_ORDER.filter((role) => (roles.get(role)?.playtime ?? 0) > 0).map((role) => {
    const a = roles.get(role)!;
    return {
      role,
      playtime: a.playtime,
      maps: a.maps.size,
      kd: rate(a.finalBlows, a.deaths),
      damagePer10: per10(a.heroDamage, a.playtime),
      healingPer10: per10(a.healing, a.playtime),
      deathsPer10: per10(a.deaths, a.playtime),
      ultEfficiency: rate(a.castsWon, a.casts),
      casts: a.casts,
    };
  });


  return { roles: cards };
}
