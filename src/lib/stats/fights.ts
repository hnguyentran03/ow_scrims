export interface KillLike {
  matchTime: number;
  attackerTeam: string;
  attackerName: string;
  victimTeam: string;
  victimName: string;
}

export interface Fight {
  start: number;
  end: number;
  kills: KillLike[];
  firstDeath: { team: string; name: string };
}

export const FIGHT_GAP_SECONDS = 15;

/** Groups kills into fights: a kill within `gapSeconds` of the previous kill belongs to the same fight. */
export function groupFights(kills: KillLike[], gapSeconds = FIGHT_GAP_SECONDS): Fight[] {
  const sorted = [...kills].sort((a, b) => a.matchTime - b.matchTime);
  const fights: Fight[] = [];
  let current: Fight | null = null;
  for (const kill of sorted) {
    if (current && kill.matchTime - current.end <= gapSeconds) {
      current.kills.push(kill);
      current.end = kill.matchTime;
    } else {
      current = {
        start: kill.matchTime,
        end: kill.matchTime,
        kills: [kill],
        firstDeath: { team: kill.victimTeam, name: kill.victimName },
      };
      fights.push(current);
    }
  }
  return fights;
}
