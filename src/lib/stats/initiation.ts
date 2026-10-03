import { killKind, type Fight } from "./fights";
import { sides, sideOf, type SideKey, type Sides } from "./sides";
import { groupByMap, rate, type MapKeyed, type TeamMapLike } from "./team-rows";

export const INITIATION_LOOKBACK_SECONDS = 10;

/** The five damage columns initiation needs; getInitiationDamage selects exactly these. */
export interface DamageLite {
  matchTime: number;
  attackerTeam: string;
  attackerName: string;
  attackerHero: string;
  victimTeam: string;
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

/**
 * Who engaged first in each fight: the earliest cross-team damage row from up to INITIATION_LOOKBACK_SECONDS before the first kill to the fight's end, never one inside the previous fight.
 * `damage` must be in ascending match-time order (as `getInitiationDamage` returns it); the earliest candidate is the first match in array order.
 */
export function buildInitiation(fights: Fight[], damage: DamageLite[], s: Sides): Initiation {
  const cross = damage.filter((d) => d.attackerTeam !== d.victimTeam);
  const acc: Record<SideKey, { initiated: number; wonWhenInitiated: number; fightsNotInitiated: number; wonWhenNotInitiated: number; decidedInitiated: number; decidedNotInitiated: number }> = {
    ours: { initiated: 0, wonWhenInitiated: 0, fightsNotInitiated: 0, wonWhenNotInitiated: 0, decidedInitiated: 0, decidedNotInitiated: 0 },
    theirs: { initiated: 0, wonWhenInitiated: 0, fightsNotInitiated: 0, wonWhenNotInitiated: 0, decidedInitiated: 0, decidedNotInitiated: 0 },
  };
  const out: FightInitiation[] = fights.map((f, i) => {
    const prev = fights[i - 1];
    const from = f.start - INITIATION_LOOKBACK_SECONDS;
    const row = cross.find((d) => d.matchTime >= from && d.matchTime <= f.end && !(prev && d.matchTime >= prev.start && d.matchTime <= prev.end));
    const winner = f.winner ? sideOf(f.winner, s) : null;
    const firstKill = f.kills.find((k) => killKind(k) === "kill");
    const initiator = row ? { side: sideOf(row.attackerTeam, s), team: row.attackerTeam, name: row.attackerName, hero: row.attackerHero, t: row.matchTime } : null;
    if (initiator?.side) {
      const me = initiator.side;
      const other: SideKey = me === "ours" ? "theirs" : "ours";
      acc[me].initiated += 1;
      acc[other].fightsNotInitiated += 1;
      if (winner) {
        acc[me].decidedInitiated += 1;
        acc[other].decidedNotInitiated += 1;
        if (winner === me) acc[me].wonWhenInitiated += 1;
        else acc[other].wonWhenNotInitiated += 1;
      }
    }
    return { index: f.index, initiator, secondsToFirstKill: initiator ? f.start - initiator.t : null, firstKillSide: firstKill ? sideOf(firstKill.attackerTeam, s) : null, winner };
  });
  const finish = (a: (typeof acc)["ours"]): InitiationSummary => ({
    initiated: a.initiated,
    wonWhenInitiated: a.wonWhenInitiated,
    decidedInitiated: a.decidedInitiated,
    fightsNotInitiated: a.fightsNotInitiated,
    wonWhenNotInitiated: a.wonWhenNotInitiated,
    decidedNotInitiated: a.decidedNotInitiated,
    initiationWinRate: rate(a.wonWhenInitiated, a.decidedInitiated),
    nonInitiationWinRate: rate(a.wonWhenNotInitiated, a.decidedNotInitiated),
  });
  return { fights: out, summary: { ours: finish(acc.ours), theirs: finish(acc.theirs) }, hasDamage: damage.length > 0 };
}

export interface TeamInitiation {
  summary: Record<SideKey, InitiationSummary>;
  /** Maps in range. */
  maps: number;
  /** Maps with at least one damage row; the others contribute nothing. */
  mapsWithDamage: number;
}

const emptySummary = (): InitiationSummary => ({ initiated: 0, wonWhenInitiated: 0, decidedInitiated: 0, fightsNotInitiated: 0, wonWhenNotInitiated: 0, decidedNotInitiated: 0, initiationWinRate: null, nonInitiationWinRate: null });

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

/** buildInitiation per map that logged damage, counters summed per side and rates recomputed from the sums. */
export function buildTeamInitiation(maps: TeamMapLike[], fights: Map<number, Fight[]>, damage: (DamageLite & MapKeyed)[]): TeamInitiation {
  const damageBy = groupByMap(damage);
  const summary = { ours: emptySummary(), theirs: emptySummary() };
  let mapsWithDamage = 0;
  for (const map of maps) {
    const rows = damageBy.get(map.id);
    if (!rows || rows.length === 0) continue;
    mapsWithDamage += 1;
    const one = buildInitiation(fights.get(map.id) ?? [], rows, sides(map));
    addSummary(summary.ours, one.summary.ours);
    addSummary(summary.theirs, one.summary.theirs);
  }
  return { summary, maps: maps.length, mapsWithDamage };
}
