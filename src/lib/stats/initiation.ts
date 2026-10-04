import { killKind, type Fight } from "./fights";
import { sides, sideOf, type SideKey, type Sides } from "./sides";
import { groupByMap, rate, type MapKeyed, type TeamMapLike } from "./team-rows";

export const INITIATION_LOOKBACK_SECONDS = 10;

/** The three damage columns that decide who engaged first; the team path loads only these. */
export interface DamageSides {
  matchTime: number;
  attackerTeam: string;
  victimTeam: string;
}

/** The five damage columns the per-map table needs (initiator name and hero too); getInitiationDamage selects exactly these. */
export interface DamageLite extends DamageSides {
  attackerName: string;
  attackerHero: string;
}

export interface FightInitiation {
  index: number;
  initiator: { side: SideKey | null; team: string; name: string; hero: string; t: number } | null;
  secondsToFirstKill: number | null;
  firstKillSide: SideKey | null;
  winner: SideKey | null;
}

export interface InitiationSummary {
  initiated: number;
  wonWhenInitiated: number;
  decidedInitiated: number;
  /** Fights the other side initiated. Fights with no initiator count for neither side. */
  fightsNotInitiated: number;
  wonWhenNotInitiated: number;
  decidedNotInitiated: number;
  initiationWinRate: number | null;
  nonInitiationWinRate: number | null;
}

export interface Initiation {
  fights: FightInitiation[];
  summary: Record<SideKey, InitiationSummary>;
  hasDamage: boolean;
}

/** Per fight, the earliest cross-team damage row in the lookback window, or null. */
function initiatorsOf<T extends DamageSides>(fights: Fight[], damage: T[]): (T | null)[] {
  const cross = damage.filter((d) => d.attackerTeam !== d.victimTeam);
  return fights.map((f, i) => {
    const prev = fights[i - 1];
    const from = f.start - INITIATION_LOOKBACK_SECONDS;
    return cross.find((d) => d.matchTime >= from && d.matchTime <= f.end && !(prev && d.matchTime >= prev.start && d.matchTime <= prev.end)) ?? null;
  });
}

/** Per-side counts from each fight's initiator and winner; rates divide by decided fights only. */
function summarize(fights: Fight[], initiators: (DamageSides | null)[], s: Sides): Record<SideKey, InitiationSummary> {
  const acc = { ours: emptySummary(), theirs: emptySummary() };
  fights.forEach((f, i) => {
    const row = initiators[i];
    const me = row ? sideOf(row.attackerTeam, s) : null;
    if (!me) return;
    const other: SideKey = me === "ours" ? "theirs" : "ours";
    const winner = f.winner ? sideOf(f.winner, s) : null;
    acc[me].initiated += 1;
    acc[other].fightsNotInitiated += 1;
    if (winner) {
      acc[me].decidedInitiated += 1;
      acc[other].decidedNotInitiated += 1;
      if (winner === me) acc[me].wonWhenInitiated += 1;
      else acc[other].wonWhenNotInitiated += 1;
    }
  });
  for (const side of ["ours", "theirs"] as const) {
    acc[side].initiationWinRate = rate(acc[side].wonWhenInitiated, acc[side].decidedInitiated);
    acc[side].nonInitiationWinRate = rate(acc[side].wonWhenNotInitiated, acc[side].decidedNotInitiated);
  }
  return acc;
}

/**
 * Who engaged first in each fight: the earliest cross-team damage row from up to INITIATION_LOOKBACK_SECONDS before the first kill to the fight's end, never one inside the previous fight.
 * `damage` must be in ascending match-time order (as `getInitiationDamage` returns it); the earliest candidate is the first match in array order.
 */
export function buildInitiation(fights: Fight[], damage: DamageLite[], s: Sides): Initiation {
  const initiators = initiatorsOf(fights, damage);
  const out: FightInitiation[] = fights.map((f, i) => {
    const row = initiators[i];
    const winner = f.winner ? sideOf(f.winner, s) : null;
    const firstKill = f.kills.find((k) => killKind(k) === "kill");
    const initiator = row ? { side: sideOf(row.attackerTeam, s), team: row.attackerTeam, name: row.attackerName, hero: row.attackerHero, t: row.matchTime } : null;
    return { index: f.index, initiator, secondsToFirstKill: initiator ? f.start - initiator.t : null, firstKillSide: firstKill ? sideOf(firstKill.attackerTeam, s) : null, winner };
  });
  return { fights: out, summary: summarize(fights, initiators, s), hasDamage: damage.length > 0 };
}

export interface TeamInitiation {
  summary: Record<SideKey, InitiationSummary>;
  /** Maps in range. */
  maps: number;
  /** Maps with at least one damage row; the others contribute nothing. */
  mapsWithDamage: number;
}

function emptySummary(): InitiationSummary {
  return { initiated: 0, wonWhenInitiated: 0, decidedInitiated: 0, fightsNotInitiated: 0, wonWhenNotInitiated: 0, decidedNotInitiated: 0, initiationWinRate: null, nonInitiationWinRate: null };
}

function addSummary(into: InitiationSummary, s: InitiationSummary): void {
  into.initiated += s.initiated;
  into.wonWhenInitiated += s.wonWhenInitiated;
  into.decidedInitiated += s.decidedInitiated;
  into.fightsNotInitiated += s.fightsNotInitiated;
  into.wonWhenNotInitiated += s.wonWhenNotInitiated;
  into.decidedNotInitiated += s.decidedNotInitiated;
  into.initiationWinRate = rate(into.wonWhenInitiated, into.decidedInitiated);
  into.nonInitiationWinRate = rate(into.wonWhenNotInitiated, into.decidedNotInitiated);
}

/** The per-side summary per map that logged damage (three damage columns suffice), counters summed and rates recomputed from the sums. */
export function buildTeamInitiation(maps: TeamMapLike[], fights: Map<number, Fight[]>, damage: (DamageSides & MapKeyed)[]): TeamInitiation {
  const damageBy = groupByMap(damage);
  const summary = { ours: emptySummary(), theirs: emptySummary() };
  let mapsWithDamage = 0;
  for (const map of maps) {
    const rows = damageBy.get(map.id);
    if (!rows || rows.length === 0) continue;
    mapsWithDamage += 1;
    const fs = fights.get(map.id) ?? [];
    const one = summarize(fs, initiatorsOf(fs, rows), sides(map));
    addSummary(summary.ours, one.ours);
    addSummary(summary.theirs, one.theirs);
  }
  return { summary, maps: maps.length, mapsWithDamage };
}
