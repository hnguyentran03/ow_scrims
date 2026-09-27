import type { HeroChange, ReplayUlt, UltState } from "./replay";
import type { Segment } from "./tracks";

/** How long an ult with no logged end counts as in progress. */
export const ULT_UNPAIRED_SECONDS = 5;

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
  const using = ults.some((u) => u.team === team && u.name === name && u.start <= t && t <= (u.end ?? u.start + ULT_UNPAIRED_SECONDS));
  if (using) return "using";
  let last: UltState["state"] | null = null;
  for (const s of ultStates) if (s.team === team && s.name === name && s.t <= t) last = s.state;
  return last === "charged" ? "charged" : null;
}
