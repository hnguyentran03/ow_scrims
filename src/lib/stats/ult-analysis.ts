import { fightIndexAt, killKind, type Fight, type KillLike } from "./fights";
import { pairUltimates, type UltLike } from "./ultimates";
import { sideOf, type SideKey, type Sides } from "./sides";

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

export const COMBO_WINDOW_SECONDS = 5;
export const COUNTER_WINDOW_SECONDS = 5;

export interface UltCast {
  team: string;
  player: string;
  hero: string;
  time: number;
}

export interface UltCombo {
  team: string;
  casts: UltCast[];
  fightIndex: number | null;
}

export interface CounterUlt {
  ult: UltCast;
  answer: UltCast;
  delaySeconds: number;
}

const toCast = (u: UltLike): UltCast => ({ team: u.playerTeam, player: u.playerName, hero: u.playerHero ?? "", time: u.matchTime });

/** Every kept cast (double casts dropped) in time order. */
export function keptCasts(starts: UltLike[], ends: UltLike[]): UltCast[] {
  return pairUltimates(starts, ends).map((p) => toCast(p.start));
}

/** Chains of two or more same-team casts where each cast is within COMBO_WINDOW_SECONDS of the previous one. */
export function ultCombos(starts: UltLike[], ends: UltLike[], fights: Fight[]): UltCombo[] {
  const open = new Map<string, UltCast[]>();
  const combos: UltCombo[] = [];
  const close = (team: string, chain: UltCast[]) => {
    if (chain.length >= 2) combos.push({ team, casts: chain, fightIndex: fightIndexAt(chain[0].time, fights) });
  };
  for (const c of keptCasts(starts, ends)) {
    const chain = open.get(c.team);
    if (chain && c.time - chain[chain.length - 1].time <= COMBO_WINDOW_SECONDS) {
      chain.push(c);
      continue;
    }
    if (chain) close(c.team, chain);
    open.set(c.team, [c]);
  }
  for (const [team, chain] of open) close(team, chain);
  return combos.sort((a, b) => a.casts[0].time - b.casts[0].time);
}

/**
 * A cast answers the latest enemy cast strictly before it within COUNTER_WINDOW_SECONDS, unless that
 * ult was already answered, so a two-ult combo answered once counts once.
 */
export function counterUlts(starts: UltLike[], ends: UltLike[]): CounterUlt[] {
  const casts = keptCasts(starts, ends);
  const answered = new Set<UltCast>();
  const out: CounterUlt[] = [];
  casts.forEach((answer, i) => {
    for (let j = i - 1; j >= 0; j--) {
      const ult = casts[j];
      if (answer.time - ult.time > COUNTER_WINDOW_SECONDS) break;
      if (ult.team === answer.team || ult.time >= answer.time) continue;
      if (!answered.has(ult)) {
        answered.add(ult);
        out.push({ ult, answer, delaySeconds: answer.time - ult.time });
      }
      break;
    }
  });
  return out;
}

export interface FightAdvantage {
  index: number;
  ours: number;
  theirs: number;
  advantage: number;
  winner: SideKey | null;
}

export interface AdvantageBucket {
  fights: number;
  won: number;
}

export interface UltAdvantage {
  fights: FightAdvantage[];
  summary: { ahead: AdvantageBucket; even: AdvantageBucket; behind: AdvantageBucket };
}

const playerKey = (team: string, player: string) => `${team}|${player}`;

/** Holding at `t`: the latest charge at or before `t` is strictly later than the latest cast at or before `t`. */
function holdsUlt(chargeTimes: number[], castTimes: number[], t: number): boolean {
  const lastCharge = chargeTimes.filter((c) => c <= t).at(-1);
  if (lastCharge === undefined) return false;
  const lastCast = castTimes.filter((c) => c <= t).at(-1);
  return lastCast === undefined || lastCharge > lastCast;
}

/** Ults held per team at each fight's first kill, with our advantage and the fight winner. Null without charge events. */
export function ultAdvantageByFight(charged: UltLike[], starts: UltLike[], ends: UltLike[], fights: Fight[], s: Sides): UltAdvantage | null {
  if (charged.length === 0) return null;
  const charges = new Map<string, number[]>();
  const casts = new Map<string, number[]>();
  const teamOf = new Map<string, string>();
  for (const c of charged) {
    const key = playerKey(c.playerTeam, c.playerName);
    charges.set(key, [...(charges.get(key) ?? []), c.matchTime].sort((a, b) => a - b));
    teamOf.set(key, c.playerTeam);
  }
  for (const c of keptCasts(starts, ends)) {
    const key = playerKey(c.team, c.player);
    casts.set(key, [...(casts.get(key) ?? []), c.time]);
    teamOf.set(key, c.team);
  }
  const held = (team: string, t: number) =>
    [...teamOf].filter(([key, owner]) => owner === team && holdsUlt(charges.get(key) ?? [], casts.get(key) ?? [], t)).length;

  const rows: FightAdvantage[] = fights.map((f) => {
    const ours = held(s.ours, f.start);
    const theirs = held(s.theirs, f.start);
    return { index: f.index, ours, theirs, advantage: ours - theirs, winner: f.winner ? sideOf(f.winner, s) : null };
  });
  const bucket = (pick: (f: FightAdvantage) => boolean): AdvantageBucket => {
    const decided = rows.filter((f) => f.winner !== null && pick(f));
    return { fights: decided.length, won: decided.filter((f) => f.winner === "ours").length };
  };
  return {
    fights: rows,
    summary: { ahead: bucket((f) => f.advantage > 0), even: bucket((f) => f.advantage === 0), behind: bucket((f) => f.advantage < 0) },
  };
}
