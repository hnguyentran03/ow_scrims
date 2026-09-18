import { ROLE_ORDER, type Role } from "./heroes";
import { per10, type PlayerRow } from "./overview";
import type { Sides } from "./sides";

export interface ComparablePlayer {
  team: string;
  name: string;
  role: Role;
  /** Heroes played, most playtime first. */
  heroes: string[];
}

export interface Selection {
  team: string;
  name: string;
  /** Omit for all heroes combined. */
  hero?: string;
}

export type CompareFormat = "int" | "rate" | "duration" | "text";

export interface CompareLine {
  label: string;
  left: number | string;
  right: number | string;
  better: "left" | "right" | null;
  format: CompareFormat;
}

export function comparablePlayers(players: PlayerRow[], s: Sides): ComparablePlayer[] {
  const byPlayer = new Map<string, PlayerRow[]>();
  for (const p of players) {
    const key = `${p.team}|${p.name}`;
    byPlayer.set(key, [...(byPlayer.get(key) ?? []), p]);
  }
  return [...byPlayer.values()]
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => b.timePlayed - a.timePlayed);
      return { team: sorted[0].team, name: sorted[0].name, role: sorted[0].role, heroes: sorted.map((r) => r.hero) };
    })
    .sort((a, b) => {
      const sideDiff = (a.team === s.ours ? 0 : 1) - (b.team === s.ours ? 0 : 1);
      if (sideDiff !== 0) return sideDiff;
      const roleDiff = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      if (roleDiff !== 0) return roleDiff;
      return a.name.localeCompare(b.name);
    });
}

type TotalKey = "timePlayed" | "eliminations" | "finalBlows" | "deaths" | "heroDamage" | "healing" | "damageTaken" | "damageBlocked" | "ultsEarned" | "ultsUsed";
const TOTAL_KEYS: TotalKey[] = ["timePlayed", "eliminations", "finalBlows", "deaths", "heroDamage", "healing", "damageTaken", "damageBlocked", "ultsEarned", "ultsUsed"];

/** Sums a player's rows across heroes; per-10 rates are recomputed from the summed playtime. */
export function aggregateRows(rows: PlayerRow[]): PlayerRow | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  const sorted = [...rows].sort((a, b) => b.timePlayed - a.timePlayed);
  const totals = Object.fromEntries(TOTAL_KEYS.map((k) => [k, rows.reduce((n, r) => n + r[k], 0)])) as Record<TotalKey, number>;
  return {
    team: sorted[0].team,
    name: sorted[0].name,
    hero: sorted.map((r) => r.hero).join(", "),
    role: sorted[0].role,
    ...totals,
    elimsPer10: per10(totals.eliminations, totals.timePlayed),
    fbPer10: per10(totals.finalBlows, totals.timePlayed),
    deathsPer10: per10(totals.deaths, totals.timePlayed),
    damagePer10: per10(totals.heroDamage, totals.timePlayed),
    healingPer10: per10(totals.healing, totals.timePlayed),
  };
}

type NumericKey = Exclude<keyof PlayerRow, "team" | "name" | "hero" | "role">;

const STAT_LINES: Array<{ key: NumericKey; label: string; format: CompareFormat; lowerIsBetter?: true; neutral?: true }> = [
  { key: "timePlayed", label: "Time played", format: "duration", neutral: true },
  { key: "eliminations", label: "Eliminations", format: "int" },
  { key: "finalBlows", label: "Final blows", format: "int" },
  { key: "deaths", label: "Deaths", format: "int", lowerIsBetter: true },
  { key: "heroDamage", label: "Hero damage", format: "int" },
  { key: "healing", label: "Healing", format: "int" },
  { key: "damageTaken", label: "Damage taken", format: "int", lowerIsBetter: true },
  { key: "damageBlocked", label: "Damage blocked", format: "int" },
  { key: "ultsEarned", label: "Ults earned", format: "int" },
  { key: "ultsUsed", label: "Ults used", format: "int" },
  { key: "elimsPer10", label: "Elims / 10", format: "rate" },
  { key: "fbPer10", label: "Final blows / 10", format: "rate" },
  { key: "deathsPer10", label: "Deaths / 10", format: "rate", lowerIsBetter: true },
  { key: "damagePer10", label: "Hero damage / 10", format: "rate" },
  { key: "healingPer10", label: "Healing / 10", format: "rate" },
];

export function compareStats(players: PlayerRow[], left: Selection, right: Selection): CompareLine[] {
  const pick = (sel: Selection) => aggregateRows(players.filter((p) => p.team === sel.team && p.name === sel.name && (!sel.hero || p.hero === sel.hero)));
  const a = pick(left);
  const b = pick(right);
  if (!a || !b) return [];
  const lines: CompareLine[] = [
    { label: "Hero", left: a.hero, right: b.hero, better: null, format: "text" },
    { label: "Team", left: a.team, right: b.team, better: null, format: "text" },
  ];
  for (const stat of STAT_LINES) {
    const l = a[stat.key];
    const r = b[stat.key];
    let better: CompareLine["better"] = null;
    if (!stat.neutral && l !== r) better = (l > r) !== Boolean(stat.lowerIsBetter) ? "left" : "right";
    lines.push({ label: stat.label, left: l, right: r, better, format: stat.format });
  }
  return lines;
}
