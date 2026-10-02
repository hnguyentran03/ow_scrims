import type { InitiationSummary, TeamInitiation } from "@/lib/stats/initiation";

/** The hint under the two initiation tiles: counts for the side, plus how many maps in range logged damage when not all did. */
export function engagedHint(s: InitiationSummary, c: TeamInitiation, first: boolean): string {
  if (c.mapsWithDamage === 0) return "damage logging was off on every map in range";
  const base = first
    ? `won ${s.wonWhenInitiated} of ${s.decidedInitiated} decided fights, engaged first in ${s.initiated}`
    : `won ${s.wonWhenNotInitiated} of ${s.decidedNotInitiated} decided fights`;
  return c.mapsWithDamage < c.maps ? `${base}, ${c.mapsWithDamage} of ${c.maps} maps logged damage` : base;
}
