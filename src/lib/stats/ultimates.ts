export interface UltLike {
  matchTime: number;
  playerTeam: string;
  playerName: string;
  playerHero: string | null;
}

export const DOUBLE_CAST_SECONDS = 1;

const byTime = <T extends { matchTime: number }>(a: T, b: T) => a.matchTime - b.matchTime;
const samePlayer = (a: UltLike, b: UltLike) => a.playerTeam === b.playerTeam && a.playerName === b.playerName;
const playerKey = (u: UltLike) => `${u.playerTeam}|${u.playerName}`;

/**
 * Pairs each ultimate_start with the first ultimate_end for the same player at or after it.
 * A start followed by another start from the same player within DOUBLE_CAST_SECONDS is a false cast and is dropped.
 */
export function pairUltimates(starts: UltLike[], ends: UltLike[]): Array<{ start: UltLike; end: UltLike | null }> {
  const sortedStarts = [...starts].sort(byTime);
  const sortedEnds = [...ends].sort(byTime);
  const kept = sortedStarts.filter((s, i) => {
    const next = sortedStarts.slice(i + 1).find((n) => samePlayer(n, s));
    return !(next && next.matchTime - s.matchTime <= DOUBLE_CAST_SECONDS);
  });
  return kept.map((start) => ({
    start,
    end: sortedEnds.find((e) => samePlayer(e, start) && e.matchTime >= start.matchTime) ?? null,
  }));
}

export interface UltTiming {
  start: UltLike;
  end: UltLike | null;
  /** Time of the first ultimate_charged after the player's previous cast, or null when none was logged. */
  chargedAt: number | null;
  /** chargedAt minus the previous cast (0 for the player's first ult on the map). */
  chargeSeconds: number | null;
  /** Cast time minus chargedAt. */
  holdSeconds: number | null;
}

/**
 * One timing per kept start. The charge meter can flicker at 100% and log many charged events, so the
 * charge moment is the first charged event strictly after the previous kept cast (at or after 0 for the
 * first) and at or before this cast.
 */
export function ultTimings(charged: UltLike[], starts: UltLike[], ends: UltLike[]): UltTiming[] {
  const chargedSorted = [...charged].sort(byTime);
  const previousCast = new Map<string, number>();
  return pairUltimates(starts, ends).map(({ start, end }) => {
    const key = playerKey(start);
    const prev = previousCast.get(key);
    const lower = prev ?? 0;
    const moment = chargedSorted.find(
      (c) => samePlayer(c, start) && (prev === undefined ? c.matchTime >= lower : c.matchTime > lower) && c.matchTime <= start.matchTime,
    );
    previousCast.set(key, start.matchTime);
    if (!moment) return { start, end, chargedAt: null, chargeSeconds: null, holdSeconds: null };
    return { start, end, chargedAt: moment.matchTime, chargeSeconds: moment.matchTime - lower, holdSeconds: start.matchTime - moment.matchTime };
  });
}
