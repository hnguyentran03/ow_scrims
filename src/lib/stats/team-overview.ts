import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { sides } from "./sides";
import { finalsByMap, outcome, rate, type StatLike, type TeamMapLike } from "./team-rows";
import { winRateByMap, winRateByType, type MapRecord, type TypeRecord } from "./trends";

export const MIN_MAP_PLAYS = 3;
export const LAST_N = 10;

export interface RoleShare {
  role: Role;
  finalBlows: number | null;
  deaths: number | null;
  heroDamage: number | null;
  healing: number | null;
}

export interface TeamOverview {
  record: { won: number; lost: number; undecided: number; maps: number; scrims: number };
  /** Record over the last LAST_N decided maps in scrim date, scrim id, map order. */
  lastTen: { won: number; lost: number };
  strongest: MapRecord | null;
  blindSpot: MapRecord | null;
  /** Same guard as strongest/blindSpot, applied to map types (game modes). */
  strongestType: TypeRecord | null;
  blindSpotType: TypeRecord | null;
  roleBalance: RoleShare[];
}

interface Ranked {
  played: number;
  winRate: number | null;
}

const qualifies = (r: Ranked) => r.played >= MIN_MAP_PLAYS && r.winRate !== null;
const byRateThenPlays = <T extends Ranked>(dir: 1 | -1, name: (r: T) => string) => (a: T, b: T) =>
  dir * ((b.winRate ?? 0) - (a.winRate ?? 0)) || b.played - a.played || name(a).localeCompare(name(b));

/** Highest and lowest win rate among records with at least MIN_MAP_PLAYS plays and a decided result. */
function extremes<T extends Ranked>(records: T[], name: (r: T) => string): { strongest: T | null; blindSpot: T | null } {
  const candidates = records.filter(qualifies);
  return {
    strongest: [...candidates].sort(byRateThenPlays(1, name))[0] ?? null,
    blindSpot: [...candidates].sort(byRateThenPlays(-1, name))[0] ?? null,
  };
}

export function buildTeamOverview(maps: TeamMapLike[], playerStats: StatLike[]): TeamOverview {
  const record = { won: 0, lost: 0, undecided: 0, maps: maps.length, scrims: new Set(maps.map((m) => m.scrimId)).size };
  for (const m of maps) record[outcome(m)] += 1;

  const lastTen = { won: 0, lost: 0 };
  for (const m of maps.filter((m) => outcome(m) !== "undecided").slice(-LAST_N)) lastTen[outcome(m) as "won" | "lost"] += 1;

  const { strongest, blindSpot } = extremes(winRateByMap(maps), (m) => m.mapName);
  const types = extremes(winRateByType(maps), (t) => t.mapType);

  const sums = new Map<Role, { finalBlows: number; deaths: number; heroDamage: number; healing: number }>();
  const total = { finalBlows: 0, deaths: 0, heroDamage: 0, healing: 0 };
  const finals = finalsByMap(playerStats);
  for (const map of maps) {
    const ours = sides(map).ours;
    for (const r of finals.get(map.id) ?? []) {
      if (r.playerTeam !== ours) continue;
      const role = roleOf(r.playerHero);
      const s = sums.get(role) ?? { finalBlows: 0, deaths: 0, heroDamage: 0, healing: 0 };
      s.finalBlows += r.finalBlows; s.deaths += r.deaths; s.heroDamage += r.heroDamageDealt; s.healing += r.healingDealt;
      total.finalBlows += r.finalBlows; total.deaths += r.deaths; total.heroDamage += r.heroDamageDealt; total.healing += r.healingDealt;
      sums.set(role, s);
    }
  }
  const roles = ROLE_ORDER.filter((role) => role !== "Unknown" || sums.has("Unknown"));
  const roleBalance = roles.map((role) => {
    const s = sums.get(role) ?? { finalBlows: 0, deaths: 0, heroDamage: 0, healing: 0 };
    return { role, finalBlows: rate(s.finalBlows, total.finalBlows), deaths: rate(s.deaths, total.deaths), heroDamage: rate(s.heroDamage, total.heroDamage), healing: rate(s.healing, total.healing) };
  });

  return { record, lastTen, strongest, blindSpot, strongestType: types.strongest, blindSpotType: types.blindSpot, roleBalance };
}
