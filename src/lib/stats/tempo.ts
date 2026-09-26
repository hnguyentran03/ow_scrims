import { killKind, type Fight, type KillLike } from "./fights";
import { sideOf, type SideKey, type Sides } from "./sides";
import { pairUltimates, type UltLike } from "./ultimates";

export const TEMPO_HALF_LIFE_SECONDS = 20;
export const KILL_WEIGHT = 1;
export const ULT_WEIGHT = 0.5;
export const TEMPO_STEP_SECONDS = 1;

export interface TempoPoint {
  t: number;
  value: number;
}

export interface TempoFight {
  index: number;
  start: number;
  end: number;
  winner: SideKey | null;
}

export interface TempoMarker {
  t: number;
  kind: "kill" | "ult";
  team: SideKey;
  player: string;
  hero: string;
}

export interface Tempo {
  series: { combined: TempoPoint[]; kills: TempoPoint[]; ults: TempoPoint[] };
  fights: TempoFight[];
  markers: TempoMarker[];
}

interface Impulse {
  t: number;
  value: number;
}

const decay = (seconds: number) => 0.5 ** (seconds / TEMPO_HALF_LIFE_SECONDS);

/** Sum of impulses, each decaying with TEMPO_HALF_LIFE_SECONDS, sampled every TEMPO_STEP_SECONDS from 0 to the duration. */
export function decayCurve(impulses: Impulse[], durationSeconds: number): TempoPoint[] {
  const sorted = [...impulses].sort((a, b) => a.t - b.t);
  const samples = Math.floor(Math.max(0, durationSeconds) / TEMPO_STEP_SECONDS);
  const points: TempoPoint[] = [];
  let value = 0;
  let prevT = 0;
  let next = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i * TEMPO_STEP_SECONDS;
    value *= decay(t - prevT);
    while (next < sorted.length && sorted[next].t <= t) {
      value += sorted[next].value * decay(t - sorted[next].t);
      next += 1;
    }
    points.push({ t, value });
    prevT = t;
  }
  return points;
}

const SIGN: Record<SideKey, number> = { ours: 1, theirs: -1 };

export function buildTempo(input: { kills: KillLike[]; starts: UltLike[]; ends: UltLike[]; fights: Fight[]; durationSeconds: number; sides: Sides }): Tempo {
  const { sides } = input;
  const kills = input.kills
    .filter((k) => killKind(k) === "kill")
    .map((k) => ({ kill: k, team: sideOf(k.attackerTeam, sides) }))
    .filter((x): x is { kill: KillLike; team: SideKey } => x.team !== null);
  const casts = pairUltimates(input.starts, input.ends)
    .map((p) => ({ ult: p.start, team: sideOf(p.start.playerTeam, sides) }))
    .filter((x): x is { ult: UltLike; team: SideKey } => x.team !== null);

  const killImpulses: Impulse[] = kills.map((x) => ({ t: x.kill.matchTime, value: SIGN[x.team] * KILL_WEIGHT }));
  const ultImpulses: Impulse[] = casts.map((x) => ({ t: x.ult.matchTime, value: SIGN[x.team] * ULT_WEIGHT }));

  const markers: TempoMarker[] = [
    ...kills.map((x): TempoMarker => ({ t: x.kill.matchTime, kind: "kill", team: x.team, player: x.kill.attackerName, hero: x.kill.attackerHero ?? "" })),
    ...casts.map((x): TempoMarker => ({ t: x.ult.matchTime, kind: "ult", team: x.team, player: x.ult.playerName, hero: x.ult.playerHero ?? "" })),
  ].sort((a, b) => a.t - b.t);

  return {
    series: {
      combined: decayCurve([...killImpulses, ...ultImpulses], input.durationSeconds),
      kills: decayCurve(killImpulses, input.durationSeconds),
      ults: decayCurve(ultImpulses, input.durationSeconds),
    },
    fights: input.fights.map((f) => ({ index: f.index, start: f.start, end: f.end, winner: f.winner ? sideOf(f.winner, sides) : null })),
    markers,
  };
}
