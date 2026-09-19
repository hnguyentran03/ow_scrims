export interface RoundLike {
  roundNumber: number;
  matchTime: number;
}

export interface RoundEndLike extends RoundLike {
  capturingTeam: string;
  team1Score: number;
  team2Score: number;
}

/** The Workshop can write the final round_end line twice; keep the first row per round, in time order. */
export function dedupeRounds<T extends RoundLike>(rows: T[]): T[] {
  const sorted = [...rows].sort((a, b) => a.matchTime - b.matchTime || a.roundNumber - b.roundNumber);
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of sorted) {
    if (seen.has(row.roundNumber)) continue;
    seen.add(row.roundNumber);
    out.push(row);
  }
  return out;
}

/**
 * Control rounds log capturing_team as "0", so fall back to whichever team's score rose since the
 * previous round end. Null when neither or both rose.
 */
export function roundCapturer(
  round: RoundEndLike,
  prev: RoundEndLike | undefined,
  map: { team1Name: string; team2Name: string },
): string | null {
  if (round.capturingTeam === map.team1Name || round.capturingTeam === map.team2Name) return round.capturingTeam;
  const d1 = round.team1Score - (prev?.team1Score ?? 0);
  const d2 = round.team2Score - (prev?.team2Score ?? 0);
  if (d1 > 0 && d2 <= 0) return map.team1Name;
  if (d2 > 0 && d1 <= 0) return map.team2Name;
  return null;
}
