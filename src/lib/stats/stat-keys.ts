import type { PlayerStatLike } from "./overview";

/** The stats a chart can plot, in display order. Each is a player_stat column summed over final-round rows. */
export type StatKey = "eliminations" | "finalBlows" | "deaths" | "heroDamage" | "healing" | "healingReceived" | "damageTaken" | "damageBlocked" | "ultsEarned" | "ultsUsed";

export const STAT_LABELS: Record<StatKey, string> = {
  eliminations: "Eliminations", finalBlows: "Final blows", deaths: "Deaths", heroDamage: "Hero damage", healing: "Healing",
  healingReceived: "Healing received", damageTaken: "Damage taken", damageBlocked: "Damage blocked", ultsEarned: "Ults earned", ultsUsed: "Ults used",
};

export const STAT_KEYS: readonly StatKey[] = Object.keys(STAT_LABELS) as StatKey[];

const PICK: Record<StatKey, (r: PlayerStatLike) => number> = {
  eliminations: (r) => r.eliminations, finalBlows: (r) => r.finalBlows, deaths: (r) => r.deaths, heroDamage: (r) => r.heroDamageDealt,
  healing: (r) => r.healingDealt, healingReceived: (r) => r.healingReceived, damageTaken: (r) => r.damageTaken, damageBlocked: (r) => r.damageBlocked,
  ultsEarned: (r) => r.ultimatesEarned, ultsUsed: (r) => r.ultimatesUsed,
};

export function statValue(row: PlayerStatLike, key: StatKey): number {
  return PICK[key](row);
}
