import { describe, expect, it } from "vitest";
import { engagedHint } from "@/app/team/teamfights/hints";
import type { InitiationSummary, TeamInitiation } from "@/lib/stats/initiation";

const summary: InitiationSummary = { initiated: 5, wonWhenInitiated: 3, decidedInitiated: 4, fightsNotInitiated: 2, wonWhenNotInitiated: 1, decidedNotInitiated: 2, initiationWinRate: 0.75, nonInitiationWinRate: 0.5 };
const coverage = (maps: number, mapsWithDamage: number): TeamInitiation => ({ summary: { ours: summary, theirs: summary }, maps, mapsWithDamage });

describe("engagedHint", () => {
  it("names the counts for engaging first and for being engaged", () => {
    expect(engagedHint(summary, coverage(3, 3), true)).toBe("won 3 of 4 decided fights, engaged first in 5");
    expect(engagedHint(summary, coverage(3, 3), false)).toBe("won 1 of 2 decided fights");
  });

  it("adds the coverage suffix only when some maps did not log damage", () => {
    expect(engagedHint(summary, coverage(3, 1), true)).toBe("won 3 of 4 decided fights, engaged first in 5, 1 of 3 maps logged damage");
  });

  it("says damage logging was off when no map logged it", () => {
    expect(engagedHint(summary, coverage(3, 0), false)).toBe("damage logging was off on every map in range");
  });
});
