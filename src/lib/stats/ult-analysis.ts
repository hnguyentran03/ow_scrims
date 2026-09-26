import { killKind, type KillLike } from "./fights";
import { pairUltimates, type UltLike } from "./ultimates";

export const CONVERSION_WINDOW_SECONDS = 8;

export interface UltDetail {
  start: UltLike;
  end: UltLike | null;
  /** Counted kills by the caster between the paired start and end; zero for an unpaired start. */
  casterKills: number;
  /** Counted kills by anyone on the caster's team within CONVERSION_WINDOW_SECONDS of the cast. */
  conversionKills: number;
  /** The caster was a victim between start and end; false for an unpaired start. */
  diedDuringUlt: boolean;
}

const isCounted = (k: KillLike) => killKind(k) === "kill";
const byCaster = (u: UltLike) => (k: KillLike) => k.attackerTeam === u.playerTeam && k.attackerName === u.playerName;
const between = (from: number, to: number) => (k: KillLike) => k.matchTime >= from && k.matchTime <= to;

export function casterKills(start: UltLike, end: UltLike | null, kills: KillLike[]): number {
  if (!end) return 0;
  return kills.filter(byCaster(start)).filter(between(start.matchTime, end.matchTime)).filter(isCounted).length;
}

export function ultDetails(starts: UltLike[], ends: UltLike[], kills: KillLike[]): UltDetail[] {
  return pairUltimates(starts, ends).map(({ start, end }) => ({
    start,
    end,
    casterKills: casterKills(start, end, kills),
    conversionKills: kills
      .filter((k) => k.attackerTeam === start.playerTeam)
      .filter(between(start.matchTime, start.matchTime + CONVERSION_WINDOW_SECONDS))
      .filter(isCounted).length,
    diedDuringUlt:
      end !== null &&
      kills.some((k) => k.victimTeam === start.playerTeam && k.victimName === start.playerName && between(start.matchTime, end.matchTime)(k)),
  }));
}
