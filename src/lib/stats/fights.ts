export interface KillLike {
  matchTime: number;
  attackerTeam: string;
  attackerName: string;
  victimTeam: string;
  victimName: string;
  attackerHero?: string;
  victimHero?: string;
  eventAbility?: string;
  isCriticalHit?: string;
  isEnvironmental?: string;
}

export type KillKind = "kill" | "suicide" | "environmental";

/** Workshop booleans arrive as "True", "False", or a censored "0". */
export function isFlagSet(value: string | undefined): boolean {
  return value === "True";
}

/** The sanitizer copies the victim into the attacker slot for suicides and environmental kills. */
export function killKind(kill: KillLike): KillKind {
  if (isFlagSet(kill.isEnvironmental)) return "environmental";
  if (kill.attackerTeam === kill.victimTeam && kill.attackerName === kill.victimName) return "suicide";
  return "kill";
}

export interface Fight {
  /** 1-based fight number in match order. */
  index: number;
  start: number;
  end: number;
  kills: KillLike[];
  firstDeath: { team: string; name: string };
  /** Counted kills per team (suicides and environmental kills count for nobody). Both teams always present. */
  killsByTeam: Record<string, number>;
  /** Team with a strict majority of counted kills, or null on a tie. */
  winner: string | null;
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
        index: fights.length + 1,
        start: kill.matchTime,
        end: kill.matchTime,
        kills: [kill],
        firstDeath: { team: kill.victimTeam, name: kill.victimName },
        killsByTeam: {},
        winner: null,
      };
      fights.push(current);
    }
  }
  for (const fight of fights) scoreFight(fight);
  return fights;
}

function scoreFight(fight: Fight): void {
  const counts: Record<string, number> = {};
  for (const kill of fight.kills) {
    counts[kill.attackerTeam] ??= 0;
    counts[kill.victimTeam] ??= 0;
    if (killKind(kill) === "kill") counts[kill.attackerTeam] += 1;
  }
  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  const leader = Object.entries(counts).find(([, c]) => c * 2 > total);
  fight.killsByTeam = counts;
  fight.winner = leader ? leader[0] : null;
}
