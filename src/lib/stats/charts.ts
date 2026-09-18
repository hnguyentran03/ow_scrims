import { killKind, type Fight, type KillLike } from "./fights";
import { roleOf, type Role } from "./heroes";
import type { Sides } from "./sides";

export interface StepPoint {
  time: number;
  ours: number;
  theirs: number;
  /** The fight this spike belongs to; null on the origin and reset points. */
  fightIndex: number | null;
  start: number;
  end: number;
}

/** One spike per fight from a zero baseline: counted kills per side at the fight's end, reset one second later. */
export function killsByFight(fights: Fight[], s: Sides): StepPoint[] {
  const points: StepPoint[] = [{ time: 0, ours: 0, theirs: 0, fightIndex: null, start: 0, end: 0 }];
  for (const f of fights) {
    points.push({ time: f.end, ours: f.killsByTeam[s.ours] ?? 0, theirs: f.killsByTeam[s.theirs] ?? 0, fightIndex: f.index, start: f.start, end: f.end });
    points.push({ time: f.end + 1, ours: 0, theirs: 0, fightIndex: null, start: f.end, end: f.end + 1 });
  }
  return points;
}

export interface RoleBars {
  role: Role;
  ours: number;
  theirs: number;
}

const CHART_ROLES: Role[] = ["Tank", "Damage", "Support"];

export function finalBlowsByRole(kills: KillLike[], s: Sides): { bars: RoleBars[]; dropped: number } {
  const bars: RoleBars[] = CHART_ROLES.map((role) => ({ role, ours: 0, theirs: 0 }));
  let dropped = 0;
  for (const k of kills) {
    if (killKind(k) !== "kill") continue;
    const bar = bars.find((b) => b.role === roleOf(k.attackerHero ?? ""));
    if (!bar) {
      dropped += 1;
      continue;
    }
    if (k.attackerTeam === s.ours) bar.ours += 1;
    else if (k.attackerTeam === s.theirs) bar.theirs += 1;
  }
  return { bars, dropped };
}

export interface RoundStatLike {
  roundNumber: number;
  playerTeam: string;
  playerName: string;
  playerHero: string;
  heroDamageDealt: number;
}

export interface RoundPoint {
  roundNumber: number;
  ours: number;
  theirs: number;
}

/** player_stat values are cumulative across rounds, so a per-round sum is already the cumulative series. */
export function damageByRound(stats: RoundStatLike[], s: Sides): RoundPoint[] {
  const seen = new Set<string>();
  const byRound = new Map<number, RoundPoint>();
  for (const r of stats) {
    const key = [r.roundNumber, r.playerTeam, r.playerName, r.playerHero].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const point = byRound.get(r.roundNumber) ?? { roundNumber: r.roundNumber, ours: 0, theirs: 0 };
    if (r.playerTeam === s.ours) point.ours += r.heroDamageDealt;
    else if (r.playerTeam === s.theirs) point.theirs += r.heroDamageDealt;
    byRound.set(r.roundNumber, point);
  }
  return [...byRound.values()].sort((a, b) => a.roundNumber - b.roundNumber);
}
