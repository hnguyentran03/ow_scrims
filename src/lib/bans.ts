import { HEROES } from "@/lib/stats/heroes";

export const MAX_BANS = 10;

export interface BanInput {
  scrimId: number;
  mapId: number;
  side: 1 | 2;
  heroes: string[];
}

function positiveInt(n: unknown): number {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) throw new Error("invalid id");
  return n;
}

/** Validates a bans update from a server action. Throws on anything unexpected; returns the deduplicated list. */
export function parseBanInput(input: { scrimId: unknown; mapId: unknown; side: unknown; heroes: unknown }): BanInput {
  const scrimId = positiveInt(input.scrimId);
  const mapId = positiveInt(input.mapId);
  if (input.side !== 1 && input.side !== 2) throw new Error("invalid side");
  if (!Array.isArray(input.heroes) || input.heroes.length > MAX_BANS) throw new Error("invalid bans");
  const heroes: string[] = [];
  for (const hero of input.heroes) {
    if (typeof hero !== "string" || !HEROES.includes(hero)) throw new Error("unknown hero");
    if (!heroes.includes(hero)) heroes.push(hero);
  }
  return { scrimId, mapId, side: input.side, heroes };
}
