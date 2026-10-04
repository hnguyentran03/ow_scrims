import { nameCandidates } from "@/lib/player-name";
import { groupFights, killKind, type KillLike } from "./fights";
import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { per10, type PlayerStatLike } from "./overview";
import { buildProfileCards, type ProfileCards, type RoundRowLike } from "./player-cards";
import { sides } from "./sides";
import { STAT_KEYS, STAT_LABELS, statValue, type StatKey } from "./stat-keys";
import { groupByMap, outcome, ourRowsByMap, rate, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";
import { winRateByMap, winRateByType, type MapRecord, type TypeRecord } from "./trends";
import { pairUltimates, ultTimings, type UltLike } from "./ultimates";

/** A map-hero pair needs this much time before it can be the best performance. */
export const BEST_PERFORMANCE_MIN_SECONDS = 180;
export const MOST_PLAYED_LIMIT = 10;
export const MATCHUP_LIMIT = 5;

export type ChartStat = StatKey;
export const CHART_STATS = STAT_LABELS;
export const CHART_STAT_KEYS = STAT_KEYS;

export type KillRowLike = KillLike & MapKeyed;
export type UltRowLike = UltLike & MapKeyed;

/** The row lists a player page needs; a TeamRows value satisfies it. */
export interface PlayerRows {
  playerStats: StatLike[];
  kills: KillRowLike[];
  ultStarts: UltRowLike[];
  ultEnds: UltRowLike[];
  ultCharged: UltRowLike[];
  roundStarts: RoundRowLike[];
}

export interface PlayerOverview {
  maps: number;
  timePlayed: number;
  record: { won: number; lost: number; undecided: number };
  winRate: number | null;
  /** Per 10 minutes of this player's hero time — unlike the Trends ult economy, which is per 10 minutes of map duration. */
  per10: Record<ChartStat, number>;
}

export interface HeroTime {
  hero: string;
  role: Role;
  playtime: number;
  share: number | null;
}

export interface RoleTime {
  role: Role;
  playtime: number;
}

export interface BestPerformance {
  mapId: number;
  scrimId: number;
  scrimName: string;
  scrimDate: string;
  mapName: string;
  hero: string;
  timePlayed: number;
  finalBlows: number;
  fbPer10: number;
  outcome: "won" | "lost" | "undecided";
}

export interface MethodCount {
  method: string;
  count: number;
  share: number | null;
}

export interface HeroCount {
  hero: string;
  count: number;
}

export interface ChartPoint {
  scrimId: number;
  name: string;
  date: string;
  maps: number;
  per10: Record<ChartStat, number>;
}

export interface FightShare {
  /** Fights where the player was first (pick or death). */
  count: number;
  /** Fights on maps the player appeared on — an approximation of participation. */
  fights: number;
  /** Of `count`, fights our side won. */
  won: number;
  /** count / fights. */
  rate: number | null;
}

export interface PlayerCards {
  firstPick: FightShare;
  firstDeath: FightShare;
  killsPerUlt: { ults: number; kills: number; perUlt: number | null };
  /** Eliminations (the player_stat column, which counts assists) over the same paired ults killsPerUlt divides by. */
  elimsPerUlt: { ults: number; elims: number; perUlt: number | null };
  avgChargeSeconds: number | null;
  avgHoldSeconds: number | null;
  /**
   * Timings behind each average: casts with both a charge moment and a hold.
   * Both counts are always equal — kept as two fields so each hint names its own count.
   */
  chargeSamples: number;
  holdSamples: number;
}

export interface PlayerPage {
  name: string;
  hero: string | null;
  heroes: string[];
  overview: PlayerOverview;
  mostPlayed: HeroTime[];
  timeByRole: RoleTime[];
  bestPerformance: BestPerformance | null;
  finalBlowsByMethod: MethodCount[];
  winRateByMap: MapRecord[];
  winRateByType: TypeRecord[];
  diedToMost: HeroCount[];
  finalBlowsOnMost: HeroCount[];
  chart: ChartPoint[];
  cards: PlayerCards;
  profile: ProfileCards;
}

/** Sum of each chart stat over `rows`, per 10 minutes of their combined hero time. */
function per10Record(rows: PlayerStatLike[]): Record<ChartStat, number> {
  const time = rows.reduce((n, r) => n + r.heroTimePlayed, 0);
  const out = {} as Record<ChartStat, number>;
  for (const k of CHART_STAT_KEYS) out[k] = per10(rows.reduce((n, r) => n + statValue(r, k), 0), time);
  return out;
}

function heroTimes(rows: StatLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.playerHero, (out.get(r.playerHero) ?? 0) + r.heroTimePlayed);
  return out;
}

const byValueDesc = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);

/** The heroes our player `name` played in range, most time first; empty when they are not on the roster. */
export function playerHeroes(maps: TeamMapLike[], playerStats: StatLike[], name: string): string[] {
  const rows = [...ourRowsByMap(maps, playerStats, name, null).values()].flat();
  return [...heroTimes(rows)].sort(byValueDesc).map(([hero]) => hero);
}

/** The roster name a dynamic route segment refers to: the decoded form first, then the raw segment; undefined when neither is on our roster in range. */
export function resolvePlayerName(maps: TeamMapLike[], playerStats: StatLike[], raw: string): string | undefined {
  return nameCandidates(raw).find((n) => playerHeroes(maps, playerStats, n).length > 0);
}

function topCounts(counts: Map<string, number>, limit: number): HeroCount[] {
  return [...counts].sort(byValueDesc).slice(0, limit).map(([hero, count]) => ({ hero, count }));
}

function buildCards(
  playerMaps: TeamMapLike[], rows: PlayerRows, name: string, filter: string | null,
  attackedBy: (k: KillLike, ours: string) => boolean, victimIs: (k: KillLike, ours: string) => boolean, elims: number,
): PlayerCards {
  const killsBy = groupByMap(rows.kills);
  const startsBy = groupByMap(rows.ultStarts);
  const endsBy = groupByMap(rows.ultEnds);
  const chargedBy = groupByMap(rows.ultCharged);
  const mine = (u: UltLike, ours: string) => u.playerTeam === ours && u.playerName === name && (filter === null || u.playerHero === filter);
  let fights = 0;
  const pick = { count: 0, won: 0 };
  const death = { count: 0, won: 0 };
  let ults = 0;
  let ultKills = 0;
  const charge: number[] = [];
  const hold: number[] = [];

  for (const m of playerMaps) {
    const ours = sides(m).ours;
    const kills = killsBy.get(m.id) ?? [];
    for (const f of groupFights(kills)) {
      fights += 1;
      const won = f.winner === ours;
      const first = f.kills.find((k) => killKind(k) === "kill");
      if (first && attackedBy(first, ours)) { pick.count += 1; if (won) pick.won += 1; }
      // groupFights sorts kills by time, so kills[0] is the fight's first death.
      if (victimIs(f.kills[0], ours)) { death.count += 1; if (won) death.won += 1; }
    }
    const starts = startsBy.get(m.id) ?? [];
    const ends = endsBy.get(m.id) ?? [];
    for (const { start, end } of pairUltimates(starts, ends)) {
      if (!mine(start, ours)) continue;
      ults += 1;
      if (!end) continue;
      ultKills += kills.filter((k) => k.attackerTeam === ours && k.attackerName === name && k.matchTime >= start.matchTime && k.matchTime <= end.matchTime && killKind(k) === "kill").length;
    }
    for (const t of ultTimings(chargedBy.get(m.id) ?? [], starts, ends)) {
      if (!mine(t.start, ours) || t.chargeSeconds === null || t.holdSeconds === null) continue;
      charge.push(t.chargeSeconds);
      hold.push(t.holdSeconds);
    }
  }
  const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
  return {
    firstPick: { ...pick, fights, rate: rate(pick.count, fights) },
    firstDeath: { ...death, fights, rate: rate(death.count, fights) },
    killsPerUlt: { ults, kills: ultKills, perUlt: rate(ultKills, ults) },
    elimsPerUlt: { ults, elims, perUlt: rate(elims, ults) },
    avgChargeSeconds: avg(charge),
    avgHoldSeconds: avg(hold),
    chargeSamples: charge.length,
    holdSamples: hold.length,
  };
}

export function buildPlayerPage(maps: TeamMapLike[], rows: PlayerRows, name: string, hero?: string): PlayerPage {
  const filter = hero ?? null;
  const heroes = playerHeroes(maps, rows.playerStats, name);
  const byMap = ourRowsByMap(maps, rows.playerStats, name, filter);
  const playerMaps = maps.filter((m) => byMap.has(m.id));
  const playerRows = playerMaps.flatMap((m) => byMap.get(m.id) ?? []);
  const timePlayed = playerRows.reduce((n, r) => n + r.heroTimePlayed, 0);
  const killsBy = groupByMap(rows.kills);
  const attackedBy = (k: KillLike, ours: string) => k.attackerTeam === ours && k.attackerName === name && (filter === null || k.attackerHero === filter);
  const victimIs = (k: KillLike, ours: string) => k.victimTeam === ours && k.victimName === name && (filter === null || k.victimHero === filter);

  const record = { won: 0, lost: 0, undecided: 0 };
  for (const m of playerMaps) record[outcome(m)] += 1;

  const times = [...heroTimes(playerRows)].sort(byValueDesc);
  const mostPlayed: HeroTime[] = times.slice(0, MOST_PLAYED_LIMIT).map(([h, playtime]) => ({ hero: h, role: roleOf(h), playtime, share: rate(playtime, timePlayed) }));
  const roleTime = new Map<Role, number>();
  for (const [h, t] of times) roleTime.set(roleOf(h), (roleTime.get(roleOf(h)) ?? 0) + t);
  const timeByRole: RoleTime[] = ROLE_ORDER.filter((r) => (roleTime.get(r) ?? 0) > 0).map((r) => ({ role: r, playtime: roleTime.get(r) ?? 0 }));

  let bestPerformance: BestPerformance | null = null;
  for (const m of playerMaps) {
    for (const r of byMap.get(m.id) ?? []) {
      if (r.heroTimePlayed < BEST_PERFORMANCE_MIN_SECONDS) continue;
      const fbPer10 = per10(r.finalBlows, r.heroTimePlayed);
      if (!bestPerformance || fbPer10 > bestPerformance.fbPer10 || (fbPer10 === bestPerformance.fbPer10 && r.finalBlows > bestPerformance.finalBlows)) {
        bestPerformance = { mapId: m.id, scrimId: m.scrimId, scrimName: m.scrimName, scrimDate: m.scrimDate, mapName: m.mapName, hero: r.playerHero, timePlayed: r.heroTimePlayed, finalBlows: r.finalBlows, fbPer10, outcome: outcome(m) };
      }
    }
  }

  const methods = new Map<string, number>();
  const diedTo = new Map<string, number>();
  const blowsOn = new Map<string, number>();
  for (const m of playerMaps) {
    const ours = sides(m).ours;
    for (const k of killsBy.get(m.id) ?? []) {
      if (attackedBy(k, ours) && killKind(k) === "kill") {
        const method = !k.eventAbility || k.eventAbility === "0" ? "Other" : k.eventAbility;
        methods.set(method, (methods.get(method) ?? 0) + 1);
        const victim = k.victimHero || "Unknown";
        blowsOn.set(victim, (blowsOn.get(victim) ?? 0) + 1);
      }
      if (victimIs(k, ours)) {
        const attacker = k.attackerHero || "Unknown";
        diedTo.set(attacker, (diedTo.get(attacker) ?? 0) + 1);
      }
    }
  }
  const methodTotal = [...methods.values()].reduce((n, c) => n + c, 0);
  const finalBlowsByMethod: MethodCount[] = [...methods].sort(byValueDesc).map(([method, count]) => ({ method, count, share: rate(count, methodTotal) }));

  const byScrim = new Map<number, { name: string; date: string; maps: number; rows: StatLike[] }>();
  for (const m of playerMaps) {
    const s = byScrim.get(m.scrimId) ?? { name: m.scrimName, date: m.scrimDate, maps: 0, rows: [] };
    s.maps += 1;
    s.rows.push(...(byMap.get(m.id) ?? []));
    byScrim.set(m.scrimId, s);
  }
  const chart: ChartPoint[] = [...byScrim].map(([scrimId, s]) => ({ scrimId, name: s.name, date: s.date, maps: s.maps, per10: per10Record(s.rows) }));

  return {
    name,
    hero: filter,
    heroes,
    overview: { maps: playerMaps.length, timePlayed, record, winRate: rate(record.won, record.won + record.lost), per10: per10Record(playerRows) },
    mostPlayed,
    timeByRole,
    bestPerformance,
    finalBlowsByMethod,
    winRateByMap: winRateByMap(playerMaps),
    winRateByType: winRateByType(playerMaps),
    diedToMost: topCounts(diedTo, MATCHUP_LIMIT),
    finalBlowsOnMost: topCounts(blowsOn, MATCHUP_LIMIT),
    chart,
    cards: buildCards(playerMaps, rows, name, filter, attackedBy, victimIs, playerRows.reduce((n, r) => n + r.eliminations, 0)),
    profile: buildProfileCards(maps, rows, name, filter),
  };
}
