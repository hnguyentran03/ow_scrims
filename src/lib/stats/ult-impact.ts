import { fightIndexAt, groupFights, type Fight, type KillLike } from "./fights";
import { roleOf, type Role } from "./heroes";
import { sideOf, sides, type SideKey, type Sides } from "./sides";
import { finalsByMap, groupByMap, rate, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";
import { keptCasts, ultDetails } from "./ult-analysis";
import type { UltLike } from "./ultimates";

/** Both the with and the without bucket need this many decided fights before a lift is shown. */
export const MIN_IMPACT_FIGHTS = 5;

/** A win-rate bucket: `count` fights including draws, `decided` with a winner, `won` by this side; `rate = won / decided`. */
export interface ImpactRatio {
  count: number;
  decided: number;
  won: number;
  rate: number | null;
}

export interface UltImpactRow {
  hero: string;
  role: Role;
  /** Kept casts of this hero's ult by this side. */
  casts: number;
  /** Casts that belong to no fight (after the last fight); never in `with`. */
  unattributed: number;
  /** Fights with at least one attributed cast of this hero's ult by this side. */
  with: ImpactRatio;
  /** The other fights on maps where this side played the hero. */
  without: ImpactRatio;
  /** with.rate − without.rate, or null under the MIN_IMPACT_FIGHTS guard. */
  lift: number | null;
  /** Mean conversion kills (team kills within CONVERSION_WINDOW_SECONDS) per cast. */
  conversionKillsPerCast: number | null;
}

export interface UltImpact {
  ours: UltImpactRow[];
  theirs: UltImpactRow[];
}

export interface Bucket {
  count: number;
  decided: number;
  won: number;
}

export const bucket = (): Bucket => ({ count: 0, decided: 0, won: 0 });

/** Adds one fight to a bucket from `side`'s point of view. */
export function tally(b: Bucket, f: Fight, side: SideKey, s: Sides): void {
  b.count += 1;
  const winner = f.winner === null ? null : sideOf(f.winner, s);
  if (winner === null) return;
  b.decided += 1;
  if (winner === side) b.won += 1;
}

export const toRatio = (b: Bucket): ImpactRatio => ({ ...b, rate: rate(b.won, b.decided) });

export function liftOf(a: Bucket, b: Bucket, min: number): number | null {
  const ra = rate(a.won, a.decided);
  const rb = rate(b.won, b.decided);
  return a.decided >= min && b.decided >= min && ra !== null && rb !== null ? ra - rb : null;
}

/** Heroes with hero time for `team` in a map's final rows. */
export function heroesPlayed(finals: StatLike[], team: string): Set<string> {
  return new Set(finals.filter((r) => r.playerTeam === team && r.heroTimePlayed > 0).map((r) => r.playerHero));
}

/** Lifted rows first by lift descending, then the rest by casts descending, then name. */
export function byImpact<T extends { lift: number | null; hero: string }>(uses: (r: T) => number): (a: T, b: T) => number {
  return (a, b) => {
    if (a.lift !== null && b.lift !== null) return b.lift - a.lift || uses(b) - uses(a) || a.hero.localeCompare(b.hero);
    if (a.lift !== null) return -1;
    if (b.lift !== null) return 1;
    return uses(b) - uses(a) || a.hero.localeCompare(b.hero);
  };
}

interface Acc {
  casts: number;
  unattributed: number;
  with: Bucket;
  without: Bucket;
  conversion: number[];
}

const newAcc = (): Acc => ({ casts: 0, unattributed: 0, with: bucket(), without: bucket(), conversion: [] });
const SIDES: SideKey[] = ["ours", "theirs"];
const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

export function buildUltImpact(
  maps: TeamMapLike[], kills: (KillLike & MapKeyed)[], ultStarts: (UltLike & MapKeyed)[], ultEnds: (UltLike & MapKeyed)[], playerStats: StatLike[],
): UltImpact {
  const killsBy = groupByMap(kills);
  const startsBy = groupByMap(ultStarts);
  const endsBy = groupByMap(ultEnds);
  const finals = finalsByMap(playerStats);
  const acc: Record<SideKey, Map<string, Acc>> = { ours: new Map(), theirs: new Map() };

  for (const map of maps) {
    const s = sides(map);
    const mapKills = killsBy.get(map.id) ?? [];
    const fights = groupFights(mapKills);
    const starts = startsBy.get(map.id) ?? [];
    const ends = endsBy.get(map.id) ?? [];
    // keptCasts and ultDetails both walk pairUltimates in cast order, so index i is the same cast in both.
    const details = ultDetails(starts, ends, mapKills);
    const casts = keptCasts(starts, ends).map((c, i) => ({ ...c, conversion: details[i].conversionKills, fightIndex: fightIndexAt(c.time, fights) }));
    const mapFinals = finals.get(map.id) ?? [];

    for (const side of SIDES) {
      const played = heroesPlayed(mapFinals, s[side]);
      const sideCasts = casts.filter((c) => sideOf(c.team, s) === side);
      for (const hero of new Set([...played, ...sideCasts.map((c) => c.hero)])) {
        const a = acc[side].get(hero) ?? newAcc();
        const heroCasts = sideCasts.filter((c) => c.hero === hero);
        a.casts += heroCasts.length;
        a.unattributed += heroCasts.filter((c) => c.fightIndex === null).length;
        a.conversion.push(...heroCasts.map((c) => c.conversion));
        const withIndex = new Set(heroCasts.map((c) => c.fightIndex));
        for (const f of fights) {
          if (withIndex.has(f.index)) tally(a.with, f, side, s);
          else if (played.has(hero)) tally(a.without, f, side, s);
        }
        acc[side].set(hero, a);
      }
    }
  }

  const rows = (m: Map<string, Acc>): UltImpactRow[] =>
    [...m]
      .filter(([, a]) => a.casts > 0)
      .map(([hero, a]) => ({
        hero, role: roleOf(hero), casts: a.casts, unattributed: a.unattributed, with: toRatio(a.with), without: toRatio(a.without),
        lift: liftOf(a.with, a.without, MIN_IMPACT_FIGHTS), conversionKillsPerCast: mean(a.conversion),
      }))
      .sort(byImpact<UltImpactRow>((r) => r.casts));
  return { ours: rows(acc.ours), theirs: rows(acc.theirs) };
}
