import { KILL_LINE_SECONDS, ULT_RING_SECONDS, type HeroChange, type ReplayKill, type ReplayUlt, type UltState } from "./replay";
import type { Segment } from "./tracks";

/** `?t=` as seconds inside [0, duration]; anything unparseable is 0. */
export function parseTimeParam(raw: string | string[] | null | undefined, duration: number): number {
  if (typeof raw !== "string") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), duration);
}

/** The interpolated ground position at `t`, or null when `t` falls outside every segment. */
export function positionAt(segments: Segment[], t: number): { x: number; z: number; window: number } | null {
  for (const seg of segments) {
    const s = seg.samples;
    if (s.length === 0 || t < s[0][0] || t > s[s.length - 1][0]) continue;
    let i = 0;
    while (i < s.length - 1 && s[i + 1][0] < t) i++;
    const [t0, x0, z0] = s[i];
    const next = s[i + 1];
    if (!next || next[0] === t0) return { x: x0, z: z0, window: seg.window };
    const k = (t - t0) / (next[0] - t0);
    return { x: x0 + (next[1] - x0) * k, z: z0 + (next[2] - z0) * k, window: seg.window };
  }
  return null;
}

export function heroAt(heroes: HeroChange[], team: string, name: string, t: number): string {
  const mine = heroes.filter((h) => h.team === team && h.name === name);
  let hero = mine[0]?.hero ?? "";
  for (const h of mine) if (h.t <= t) hero = h.hero;
  return hero;
}

export function ultStateAt(ultStates: UltState[], ults: ReplayUlt[], team: string, name: string, t: number): "charged" | "using" | null {
  const using = ults.some((u) => u.team === team && u.name === name && u.start <= t && t <= (u.end ?? u.start + ULT_RING_SECONDS));
  if (using) return "using";
  let last: UltState["state"] | null = null;
  for (const s of ultStates) if (s.team === team && s.name === name && s.t <= t) last = s.state;
  return last === "charged" ? "charged" : null;
}

const ULT_PULSE_SECONDS = 1;

export function activeKillLines(kills: ReplayKill[], t: number): ReplayKill[] {
  return kills.filter((k) => k.kind === "kill" && k.attacker !== null && k.attacker.x !== null && k.victim.x !== null && k.t <= t && t <= k.t + KILL_LINE_SECONDS);
}

export function activeUltRings(ults: ReplayUlt[], t: number): ReplayUlt[] {
  return ults.filter((u) => u.start <= t && t <= (u.end ?? u.start + ULT_RING_SECONDS));
}

/** 0..1 through a one-second pulse at the cast position, or null outside it or when the ult has no position. */
export function ultPulse(ult: ReplayUlt, t: number): number | null {
  if (ult.x === null || t < ult.start || t > ult.start + ULT_PULSE_SECONDS) return null;
  return (t - ult.start) / ULT_PULSE_SECONDS;
}

/** The ghost's own clock for our time `t`: offset by the two windows' starts, or by their first kills when both exist. */
export function ghostTime(t: number, own: { start: number; firstKill: number | null }, ghost: { start: number; firstKill: number | null }, mode: "start" | "first-kill"): number {
  if (mode === "first-kill" && own.firstKill !== null && ghost.firstKill !== null) return t - own.firstKill + ghost.firstKill;
  return t - own.start + ghost.start;
}
