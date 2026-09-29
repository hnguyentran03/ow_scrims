import { groupFights, type KillLike } from "./fights";
import { ROLE_ORDER, roleOf, type Role } from "./heroes";

export interface PlayerStatLike {
  roundNumber: number;
  playerTeam: string;
  playerName: string;
  playerHero: string;
  eliminations: number;
  finalBlows: number;
  deaths: number;
  heroDamageDealt: number;
  healingDealt: number;
  damageTaken: number;
  damageBlocked: number;
  ultimatesEarned: number;
  ultimatesUsed: number;
  multikillBest: number;
  soloKills: number;
  objectiveKills: number;
  heroTimePlayed: number;
}

export interface PlayerRow {
  team: string;
  name: string;
  hero: string;
  role: Role;
  timePlayed: number;
  eliminations: number;
  finalBlows: number;
  deaths: number;
  heroDamage: number;
  healing: number;
  damageTaken: number;
  damageBlocked: number;
  ultsEarned: number;
  ultsUsed: number;
  elimsPer10: number;
  fbPer10: number;
  deathsPer10: number;
  damagePer10: number;
  healingPer10: number;
}

export interface TeamTotals {
  team: string;
  heroDamage: number;
  healing: number;
}

export interface Overview {
  teamTotals: [TeamTotals, TeamTotals];
  players: PlayerRow[];
  analysis: {
    fights: number;
    firstDeathPct: Record<string, number>;
    mostFirstDeaths: { team: string; name: string; count: number } | null;
  };
}

export function per10(value: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return (value / seconds) * 600;
}

const KEY_SEP = "|";

/**
 * player_stat rows are cumulative per round; keep the highest round for each team/player/hero.
 * Rows arrive in log order, and a round can log more than one cumulative snapshot (e.g. a
 * mid-round checkpoint and a match-end summary sharing the last round number) — on a tie, the
 * later row in log order is the more complete one, so it wins.
 */
export function finalRoundRows<T extends PlayerStatLike>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = [row.playerTeam, row.playerName, row.playerHero].join(KEY_SEP);
    const prev = best.get(key);
    if (!prev || row.roundNumber >= prev.roundNumber) best.set(key, row);
  }
  return [...best.values()];
}

export function buildOverview(input: {
  team1Name: string;
  team2Name: string;
  ourTeam: string;
  playerStats: PlayerStatLike[];
  kills: KillLike[];
}): Overview {
  const { team1Name, team2Name, ourTeam } = input;
  const finals = finalRoundRows(input.playerStats);

  const totals = (team: string): TeamTotals => {
    const rows = finals.filter((r) => r.playerTeam === team);
    return {
      team,
      heroDamage: rows.reduce((n, r) => n + r.heroDamageDealt, 0),
      healing: rows.reduce((n, r) => n + r.healingDealt, 0),
    };
  };

  const players: PlayerRow[] = finals
    .filter((r) => r.heroTimePlayed > 0)
    .map((r) => ({
      team: r.playerTeam,
      name: r.playerName,
      hero: r.playerHero,
      role: roleOf(r.playerHero),
      timePlayed: r.heroTimePlayed,
      eliminations: r.eliminations,
      finalBlows: r.finalBlows,
      deaths: r.deaths,
      heroDamage: r.heroDamageDealt,
      healing: r.healingDealt,
      damageTaken: r.damageTaken,
      damageBlocked: r.damageBlocked,
      ultsEarned: r.ultimatesEarned,
      ultsUsed: r.ultimatesUsed,
      elimsPer10: per10(r.eliminations, r.heroTimePlayed),
      fbPer10: per10(r.finalBlows, r.heroTimePlayed),
      deathsPer10: per10(r.deaths, r.heroTimePlayed),
      damagePer10: per10(r.heroDamageDealt, r.heroTimePlayed),
      healingPer10: per10(r.healingDealt, r.heroTimePlayed),
    }))
    .sort((a, b) => {
      const teamA = a.team === ourTeam ? 0 : 1;
      const teamB = b.team === ourTeam ? 0 : 1;
      if (teamA !== teamB) return teamA - teamB;
      const roleDiff = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      if (roleDiff !== 0) return roleDiff;
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      return b.timePlayed - a.timePlayed;
    });

  const fights = groupFights(input.kills);
  const firstDeathCount: Record<string, number> = { [team1Name]: 0, [team2Name]: 0 };
  const byPlayer = new Map<string, { team: string; name: string; count: number }>();
  for (const f of fights) {
    firstDeathCount[f.firstDeath.team] = (firstDeathCount[f.firstDeath.team] ?? 0) + 1;
    const key = [f.firstDeath.team, f.firstDeath.name].join(KEY_SEP);
    const entry = byPlayer.get(key) ?? { team: f.firstDeath.team, name: f.firstDeath.name, count: 0 };
    entry.count += 1;
    byPlayer.set(key, entry);
  }
  const firstDeathPct: Record<string, number> = {};
  for (const [team, n] of Object.entries(firstDeathCount)) {
    firstDeathPct[team] = fights.length === 0 ? 0 : n / fights.length;
  }
  const mostFirstDeaths = [...byPlayer.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    teamTotals: [totals(team1Name), totals(team2Name)],
    players,
    analysis: { fights: fights.length, firstDeathPct, mostFirstDeaths },
  };
}
