import { roleOf, type Role } from "./heroes";
import { per10 } from "./overview";
import { sides, type SideKey } from "./sides";
import { finalsByMap, groupByMap, outcome, rate, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";
import { ultTimings, type UltLike } from "./ultimates";

interface Tally {
  played: number;
  won: number;
  lost: number;
  undecided: number;
}

export interface MapRecord extends Tally {
  mapName: string;
  mapType: string;
  winRate: number | null;
}

export interface TypeRecord extends Tally {
  mapType: string;
  winRate: number | null;
}

export const MAP_TYPE_ORDER = ["Control", "Escort", "Flashpoint", "Hybrid", "Push", "Clash"];

function tally(maps: TeamMapLike[], keyOf: (m: TeamMapLike) => string): Map<string, Tally> {
  const out = new Map<string, Tally>();
  for (const m of maps) {
    const t = out.get(keyOf(m)) ?? { played: 0, won: 0, lost: 0, undecided: 0 };
    t.played += 1;
    t[outcome(m)] += 1;
    out.set(keyOf(m), t);
  }
  return out;
}

export function winRateByMap(maps: TeamMapLike[]): MapRecord[] {
  const types = new Map(maps.map((m) => [m.mapName, m.mapType]));
  return [...tally(maps, (m) => m.mapName)]
    .map(([mapName, t]) => ({ mapName, mapType: types.get(mapName) ?? "", ...t, winRate: rate(t.won, t.won + t.lost) }))
    .sort((a, b) => b.played - a.played || a.mapName.localeCompare(b.mapName));
}

export function winRateByType(maps: TeamMapLike[]): TypeRecord[] {
  const order = (t: string) => {
    const i = MAP_TYPE_ORDER.indexOf(t);
    return i === -1 ? MAP_TYPE_ORDER.length : i;
  };
  return [...tally(maps, (m) => m.mapType)]
    .map(([mapType, t]) => ({ mapType, ...t, winRate: rate(t.won, t.won + t.lost) }))
    .sort((a, b) => order(a.mapType) - order(b.mapType) || a.mapType.localeCompare(b.mapType));
}

export interface BanLike extends MapKeyed {
  side: number;
  hero: string;
}

export interface HeroPick {
  hero: string;
  role: Role;
  picks: number;
  /** Maps in range where neither team banned the hero. A map with no ban rows counts as available. */
  available: number;
  pickRate: number | null;
  playtime: number;
  playtimeShare: number | null;
}

/** Heroes picked at least once by `side`, with pick rate over available maps and share of that side's playtime. */
export function heroPicks(maps: TeamMapLike[], playerStats: StatLike[], bans: BanLike[], side: SideKey): HeroPick[] {
  const finals = finalsByMap(playerStats);
  const bansByMap = groupByMap(bans);
  const acc = new Map<string, { picks: number; playtime: number }>();
  let total = 0;
  for (const map of maps) {
    const team = sides(map)[side];
    const picked = new Map<string, number>();
    for (const r of finals.get(map.id) ?? []) {
      if (r.playerTeam !== team || r.heroTimePlayed <= 0) continue;
      picked.set(r.playerHero, (picked.get(r.playerHero) ?? 0) + r.heroTimePlayed);
    }
    for (const [hero, time] of picked) {
      const a = acc.get(hero) ?? { picks: 0, playtime: 0 };
      a.picks += 1;
      a.playtime += time;
      total += time;
      acc.set(hero, a);
    }
  }
  const bannedOn = (hero: string) => maps.filter((m) => (bansByMap.get(m.id) ?? []).some((b) => b.hero === hero)).length;
  return [...acc]
    .map(([hero, a]) => {
      const available = maps.length - bannedOn(hero);
      return { hero, role: roleOf(hero), picks: a.picks, available, pickRate: rate(a.picks, available), playtime: a.playtime, playtimeShare: rate(a.playtime, total) };
    })
    .sort((a, b) => b.picks - a.picks || b.playtime - a.playtime || a.hero.localeCompare(b.hero));
}

export type UltRowLike = UltLike & MapKeyed;

export interface UltEconomyPoint {
  scrimId: number;
  name: string;
  date: string;
  maps: number;
  earnedPer10: number;
  usedPer10: number;
  avgChargeSeconds: number | null;
  avgHoldSeconds: number | null;
}

/** One point per scrim in the order the maps arrive (scrim date order from getTeamRows). Only our team's ults count. */
export function ultEconomyByScrim(maps: TeamMapLike[], playerStats: StatLike[], charged: UltRowLike[], starts: UltRowLike[], ends: UltRowLike[]): UltEconomyPoint[] {
  const finals = finalsByMap(playerStats);
  const chargedBy = groupByMap(charged);
  const startsBy = groupByMap(starts);
  const endsBy = groupByMap(ends);
  const byScrim = new Map<number, { name: string; date: string; maps: number; seconds: number; earned: number; used: number; charge: number[]; hold: number[] }>();
  for (const map of maps) {
    const ours = sides(map).ours;
    const s = byScrim.get(map.scrimId) ?? { name: map.scrimName, date: map.scrimDate, maps: 0, seconds: 0, earned: 0, used: 0, charge: [], hold: [] };
    s.maps += 1;
    s.seconds += map.durationSeconds;
    for (const r of finals.get(map.id) ?? []) {
      if (r.playerTeam !== ours) continue;
      s.earned += r.ultimatesEarned;
      s.used += r.ultimatesUsed;
    }
    for (const t of ultTimings(chargedBy.get(map.id) ?? [], startsBy.get(map.id) ?? [], endsBy.get(map.id) ?? [])) {
      if (t.start.playerTeam !== ours || t.chargeSeconds === null || t.holdSeconds === null) continue;
      s.charge.push(t.chargeSeconds);
      s.hold.push(t.holdSeconds);
    }
    byScrim.set(map.scrimId, s);
  }
  const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
  return [...byScrim].map(([scrimId, s]) => ({
    scrimId, name: s.name, date: s.date, maps: s.maps,
    earnedPer10: per10(s.earned, s.seconds), usedPer10: per10(s.used, s.seconds),
    avgChargeSeconds: avg(s.charge), avgHoldSeconds: avg(s.hold),
  }));
}
