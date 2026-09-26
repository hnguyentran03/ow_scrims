import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { finalRoundRows, per10, type PlayerStatLike } from "./overview";
import { sideOf, sides, type SideKey } from "./sides";

export interface DamageLike {
  attackerTeam: string;
  attackerName: string;
  attackerHero: string;
  victimTeam: string;
  victimName: string;
  victimHero: string;
  eventDamage: number;
}

export interface TelemetryMapLike {
  team1Name: string;
  team2Name: string;
  ourSide: number;
}

export interface Lane {
  hero: string;
  damage: number;
  share: number;
}

export interface RoleShare {
  role: Role;
  damage: number;
  share: number;
}

export interface RadarAxis {
  label: string;
  player: number;
  opponent: number;
  /** Larger of the two values, or 1 when both are zero. */
  max: number;
}

export interface RadarOpponent {
  name: string;
  hero: string;
  role: Role;
}

export interface TelemetryPlayer {
  team: string;
  name: string;
  side: SideKey | null;
  role: Role;
  hero: string;
  timePlayed: number;
  dealt: Lane[];
  received: Lane[];
  focusFire: { received: RoleShare[]; dealt: RoleShare[] };
  radar: { opponent: RadarOpponent | null; axes: RadarAxis[] };
}

export interface Telemetry {
  hasDamage: boolean;
  players: TelemetryPlayer[];
}

export interface PlayerTotals {
  team: string;
  name: string;
  hero: string;
  role: Role;
  time: number;
  timeByRole: Record<Role, number>;
  eliminations: number;
  finalBlows: number;
  deaths: number;
  heroDamage: number;
  healing: number;
  damageTaken: number;
  damageBlocked: number;
}

const zeroByRole = (): Record<Role, number> => ({ Tank: 0, Damage: 0, Support: 0, Unknown: 0 });

/** One row per player with hero time, summed across heroes; role and hero are the ones with the most time. */
export function playerTotals(playerStats: PlayerStatLike[]): PlayerTotals[] {
  const byPlayer = new Map<string, PlayerStatLike[]>();
  for (const r of finalRoundRows(playerStats)) {
    if (r.heroTimePlayed <= 0) continue;
    const key = `${r.playerTeam}|${r.playerName}`;
    byPlayer.set(key, [...(byPlayer.get(key) ?? []), r]);
  }
  return [...byPlayer.values()].map((rows) => {
    const timeByRole = zeroByRole();
    for (const r of rows) timeByRole[roleOf(r.playerHero)] += r.heroTimePlayed;
    const role = ROLE_ORDER.reduce((best, r) => (timeByRole[r] > timeByRole[best] ? r : best), ROLE_ORDER[0]);
    const top = [...rows].sort((a, b) => b.heroTimePlayed - a.heroTimePlayed || a.playerHero.localeCompare(b.playerHero))[0];
    const sum = (pick: (r: PlayerStatLike) => number) => rows.reduce((n, r) => n + pick(r), 0);
    return {
      team: top.playerTeam,
      name: top.playerName,
      hero: top.playerHero,
      role,
      time: sum((r) => r.heroTimePlayed),
      timeByRole,
      eliminations: sum((r) => r.eliminations),
      finalBlows: sum((r) => r.finalBlows),
      deaths: sum((r) => r.deaths),
      heroDamage: sum((r) => r.heroDamageDealt),
      healing: sum((r) => r.healingDealt),
      damageTaken: sum((r) => r.damageTaken),
      damageBlocked: sum((r) => r.damageBlocked),
    };
  });
}

function lanes(rows: DamageLike[], heroOf: (d: DamageLike) => string): Lane[] {
  const sum = new Map<string, number>();
  for (const d of rows) sum.set(heroOf(d), (sum.get(heroOf(d)) ?? 0) + d.eventDamage);
  const total = [...sum.values()].reduce((n, v) => n + v, 0);
  return [...sum]
    .map(([hero, damage]) => ({ hero, damage, share: total ? damage / total : 0 }))
    .sort((a, b) => b.damage - a.damage || a.hero.localeCompare(b.hero));
}

function roleShares(rows: DamageLike[], roleFor: (d: DamageLike) => Role): RoleShare[] {
  const sum = zeroByRole();
  for (const d of rows) sum[roleFor(d)] += d.eventDamage;
  const total = ROLE_ORDER.reduce((n, r) => n + sum[r], 0);
  return ROLE_ORDER.map((role) => ({ role, damage: sum[role], share: total ? sum[role] / total : 0 }));
}

const ROLE_AXIS: Record<Role, { label: string; pick: (t: PlayerTotals) => number }> = {
  Support: { label: "Healing", pick: (t) => t.healing },
  Tank: { label: "Blocked", pick: (t) => t.damageBlocked },
  Damage: { label: "Damage taken", pick: (t) => t.damageTaken },
  Unknown: { label: "Damage taken", pick: (t) => t.damageTaken },
};

/** The enemy with the most hero time in the player's role (ties by name) and five per-10 axes against them. */
function radarFor(player: PlayerTotals, all: PlayerTotals[]): TelemetryPlayer["radar"] {
  const opponent =
    all
      .filter((o) => o.team !== player.team && o.timeByRole[player.role] > 0)
      .sort((a, b) => b.timeByRole[player.role] - a.timeByRole[player.role] || a.name.localeCompare(b.name))[0] ?? null;
  const axis = (label: string, pick: (t: PlayerTotals) => number): RadarAxis => {
    const mine = per10(pick(player), player.time);
    const theirs = opponent ? per10(pick(opponent), opponent.time) : 0;
    return { label, player: mine, opponent: theirs, max: Math.max(mine, theirs) || 1 };
  };
  const roleAxis = ROLE_AXIS[player.role];
  return {
    opponent: opponent ? { name: opponent.name, hero: opponent.hero, role: opponent.role } : null,
    axes: [
      axis("Elims", (t) => t.eliminations),
      axis("Final blows", (t) => t.finalBlows),
      axis("Hero damage", (t) => t.heroDamage),
      axis("Deaths", (t) => t.deaths),
      axis(roleAxis.label, roleAxis.pick),
    ],
  };
}

export function buildTelemetry(input: { map: TelemetryMapLike; damage: DamageLike[]; playerStats: PlayerStatLike[] }): Telemetry {
  const s = sides(input.map);
  const cross = input.damage.filter((d) => d.attackerTeam !== d.victimTeam);
  const all = playerTotals(input.playerStats);
  const order = (t: PlayerTotals) => {
    const side = sideOf(t.team, s);
    return side === "ours" ? 0 : side === "theirs" ? 1 : 2;
  };
  const players = [...all]
    .sort((a, b) => order(a) - order(b) || b.time - a.time || a.name.localeCompare(b.name))
    .map((p): TelemetryPlayer => {
      const dealtRows = cross.filter((d) => d.attackerTeam === p.team && d.attackerName === p.name);
      const receivedRows = cross.filter((d) => d.victimTeam === p.team && d.victimName === p.name);
      return {
        team: p.team,
        name: p.name,
        side: sideOf(p.team, s),
        role: p.role,
        hero: p.hero,
        timePlayed: p.time,
        dealt: lanes(dealtRows, (d) => d.victimHero),
        received: lanes(receivedRows, (d) => d.attackerHero),
        focusFire: { received: roleShares(receivedRows, (d) => roleOf(d.attackerHero)), dealt: roleShares(dealtRows, (d) => roleOf(d.victimHero)) },
        radar: radarFor(p, all),
      };
    });
  return { hasDamage: cross.length > 0, players };
}
