import { fightIndexAt } from "./events";
import { killKind, type Fight } from "./fights";
import { sideOf, sides, type SideKey } from "./sides";
import { groupByMap, rate, type MapKeyed, type TeamMapLike } from "./team-rows";
import { pairUltimates, type UltLike } from "./ultimates";

export interface Ratio {
  count: number;
  won: number;
  /** won / count, null when count is 0. */
  rate: number | null;
}

export interface TeamFightStats {
  fights: number;
  won: number;
  lost: number;
  drawn: number;
  /** won / (won + lost). */
  winRate: number | null;
  /** Fights where this team's player landed the first counted kill. */
  firstPick: Ratio;
  /** Fights where this team suffered the first death (any kill row). */
  firstDeath: Ratio;
  /** Fights where this team cast the earliest ult attributed to the fight. */
  firstUlt: Ratio;
  /** Fights won after suffering the first death. */
  reversals: number;
  /** Fights where this team cast no ult; rate is count / fights, winRate is won / count. */
  dry: Ratio & { winRate: number | null };
  /** Every kept cast by this team, in a fight or not. */
  ultsUsed: number;
  ultsPerFight: number | null;
  /** Fights won per ult cast. */
  ultEfficiency: number | null;
  /** Ults cast in a fight this team lost or drew, plus ults that belong to no fight. */
  wastedUlts: number;
}

export interface ScrimFightRow {
  scrimId: number;
  name: string;
  date: string;
  fights: number;
  won: number;
  lost: number;
  drawn: number;
  winRate: number | null;
}

export interface Teamfights {
  ours: TeamFightStats;
  theirs: TeamFightStats;
  byScrim: ScrimFightRow[];
}

interface Counts {
  count: number;
  won: number;
}

interface Acc {
  fights: number;
  won: number;
  lost: number;
  drawn: number;
  firstPick: Counts;
  firstDeath: Counts;
  firstUlt: Counts;
  reversals: number;
  dry: Counts;
  ultsUsed: number;
  wastedUlts: number;
}

const counts = (): Counts => ({ count: 0, won: 0 });
const newAcc = (): Acc => ({ fights: 0, won: 0, lost: 0, drawn: 0, firstPick: counts(), firstDeath: counts(), firstUlt: counts(), reversals: 0, dry: counts(), ultsUsed: 0, wastedUlts: 0 });
const ratio = (c: Counts): Ratio => ({ ...c, rate: rate(c.won, c.count) });

function finish(a: Acc): TeamFightStats {
  return {
    fights: a.fights, won: a.won, lost: a.lost, drawn: a.drawn, winRate: rate(a.won, a.won + a.lost),
    firstPick: ratio(a.firstPick), firstDeath: ratio(a.firstDeath), firstUlt: ratio(a.firstUlt), reversals: a.reversals,
    dry: { ...a.dry, rate: rate(a.dry.count, a.fights), winRate: rate(a.dry.won, a.dry.count) },
    ultsUsed: a.ultsUsed, ultsPerFight: rate(a.ultsUsed, a.fights), ultEfficiency: rate(a.won, a.ultsUsed), wastedUlts: a.wastedUlts,
  };
}

const SIDES: SideKey[] = ["ours", "theirs"];

export function buildTeamfights(maps: TeamMapLike[], fightsOf: Map<number, Fight[]>, ultStarts: (UltLike & MapKeyed)[], ultEnds: (UltLike & MapKeyed)[]): Teamfights {
  const startsBy = groupByMap(ultStarts);
  const endsBy = groupByMap(ultEnds);
  const acc: Record<SideKey, Acc> = { ours: newAcc(), theirs: newAcc() };
  const scrims = new Map<number, Omit<ScrimFightRow, "scrimId" | "winRate">>();

  for (const map of maps) {
    const s = sides(map);
    const side = (team: string | null | undefined): SideKey | null => (team ? sideOf(team, s) : null);
    const fights = fightsOf.get(map.id) ?? [];
    // pairUltimates sorts starts by time, so `ults` is in cast order.
    const ults = pairUltimates(startsBy.get(map.id) ?? [], endsBy.get(map.id) ?? []).map(({ start }) => ({
      side: side(start.playerTeam), fightIndex: fightIndexAt(start.matchTime, fights),
    }));
    const scrim = scrims.get(map.scrimId) ?? { name: map.scrimName, date: map.scrimDate, fights: 0, won: 0, lost: 0, drawn: 0 };

    for (const f of fights) {
      const winner = side(f.winner);
      const firstPick = side(f.kills.find((k) => killKind(k) === "kill")?.attackerTeam);
      const firstDeath = side(f.firstDeath.team);
      const inFight = ults.filter((u) => u.fightIndex === f.index);
      const firstUlt = inFight[0]?.side ?? null;
      for (const key of SIDES) {
        const a = acc[key];
        const won = winner === key;
        a.fights += 1;
        if (winner === null) a.drawn += 1;
        else if (won) a.won += 1;
        else a.lost += 1;
        if (firstPick === key) { a.firstPick.count += 1; if (won) a.firstPick.won += 1; }
        if (firstDeath === key) { a.firstDeath.count += 1; if (won) { a.firstDeath.won += 1; a.reversals += 1; } }
        if (firstUlt === key) { a.firstUlt.count += 1; if (won) a.firstUlt.won += 1; }
        if (!inFight.some((u) => u.side === key)) { a.dry.count += 1; if (won) a.dry.won += 1; }
      }
      scrim.fights += 1;
      if (winner === "ours") scrim.won += 1;
      else if (winner === "theirs") scrim.lost += 1;
      else scrim.drawn += 1;
    }

    for (const u of ults) {
      if (u.side === null) continue;
      acc[u.side].ultsUsed += 1;
      const fight = u.fightIndex === null ? null : fights[u.fightIndex - 1];
      if (!fight || side(fight.winner) !== u.side) acc[u.side].wastedUlts += 1;
    }
    scrims.set(map.scrimId, scrim);
  }

  return {
    ours: finish(acc.ours),
    theirs: finish(acc.theirs),
    byScrim: [...scrims].map(([scrimId, r]) => ({ scrimId, ...r, winRate: rate(r.won, r.won + r.lost) })),
  };
}
