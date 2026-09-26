import { killKind, type KillLike } from "./fights";
import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { per10, type PlayerStatLike } from "./overview";
import { sides } from "./sides";
import { finalsByMap, groupByMap, outcome, rate, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";
import { winRateByMap, winRateByType, type MapRecord, type TypeRecord } from "./trends";
import type { UltLike } from "./ultimates";

/** A map-hero pair needs this much time before it can be the best performance. */
export const BEST_PERFORMANCE_MIN_SECONDS = 180;
export const MOST_PLAYED_LIMIT = 10;
export const MATCHUP_LIMIT = 5;

export type ChartStat = "eliminations" | "finalBlows" | "deaths" | "heroDamage" | "healing" | "damageTaken" | "damageBlocked" | "ultsEarned" | "ultsUsed";

export const CHART_STATS: Record<ChartStat, string> = {
  eliminations: "Eliminations", finalBlows: "Final blows", deaths: "Deaths", heroDamage: "Hero damage", healing: "Healing",
  damageTaken: "Damage taken", damageBlocked: "Damage blocked", ultsEarned: "Ults earned", ultsUsed: "Ults used",
};
export const CHART_STAT_KEYS = Object.keys(CHART_STATS) as ChartStat[];

const STAT_OF: Record<ChartStat, (r: PlayerStatLike) => number> = {
  eliminations: (r) => r.eliminations, finalBlows: (r) => r.finalBlows, deaths: (r) => r.deaths, heroDamage: (r) => r.heroDamageDealt,
  healing: (r) => r.healingDealt, damageTaken: (r) => r.damageTaken, damageBlocked: (r) => r.damageBlocked,
  ultsEarned: (r) => r.ultimatesEarned, ultsUsed: (r) => r.ultimatesUsed,
};

export type KillRowLike = KillLike & MapKeyed;
export type UltRowLike = UltLike & MapKeyed;

/** The row lists a player page needs; a TeamRows value satisfies it. */
export interface PlayerRows {
  playerStats: StatLike[];
  kills: KillRowLike[];
  ultStarts: UltRowLike[];
  ultEnds: UltRowLike[];
  ultCharged: UltRowLike[];
}

export interface PlayerOverview {
  maps: number;
  timePlayed: number;
  record: { won: number; lost: number; undecided: number };
  winRate: number | null;
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
}

/** Sum of each chart stat over `rows`, per 10 minutes of their combined hero time. */
function per10Record(rows: PlayerStatLike[]): Record<ChartStat, number> {
  const time = rows.reduce((n, r) => n + r.heroTimePlayed, 0);
  const out = {} as Record<ChartStat, number>;
  for (const k of CHART_STAT_KEYS) out[k] = per10(rows.reduce((n, r) => n + STAT_OF[k](r), 0), time);
  return out;
}

/** Final rows for `name` on our side with time on the hero, per map in map order. */
function ourRowsByMap(maps: TeamMapLike[], playerStats: StatLike[], name: string, hero: string | null): Map<number, StatLike[]> {
  const finals = finalsByMap(playerStats);
  const out = new Map<number, StatLike[]>();
  for (const map of maps) {
    const ours = sides(map).ours;
    const rows = (finals.get(map.id) ?? []).filter((r) => r.playerTeam === ours && r.playerName === name && r.heroTimePlayed > 0 && (hero === null || r.playerHero === hero));
    if (rows.length > 0) out.set(map.id, rows);
  }
  return out;
}

function heroTimes(rows: StatLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.playerHero, (out.get(r.playerHero) ?? 0) + r.heroTimePlayed);
  return out;
}

const byTimeDesc = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);

/** The heroes our player `name` played in range, most time first; empty when they are not on the roster. */
export function playerHeroes(maps: TeamMapLike[], playerStats: StatLike[], name: string): string[] {
  const rows = [...ourRowsByMap(maps, playerStats, name, null).values()].flat();
  return [...heroTimes(rows)].sort(byTimeDesc).map(([hero]) => hero);
}

function topCounts(counts: Map<string, number>, limit: number): HeroCount[] {
  return [...counts].sort(byTimeDesc).slice(0, limit).map(([hero, count]) => ({ hero, count }));
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

  const times = [...heroTimes(playerRows)].sort(byTimeDesc);
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
  const finalBlowsByMethod: MethodCount[] = [...methods].sort(byTimeDesc).map(([method, count]) => ({ method, count, share: rate(count, methodTotal) }));

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
  };
}
