import { describe, expect, it } from "vitest";
import { finalsByMap, groupByMap, outcome, rate } from "@/lib/stats/team-rows";

const stat = (mapId: number, roundNumber: number, playerName: string, eliminations: number) => ({
  mapId, roundNumber, playerTeam: "Team 1", playerName, playerHero: "Ana", eliminations, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0,
  damageTaken: 0, damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, heroTimePlayed: 100,
});

describe("team-rows", () => {
  it("groups rows by map", () => {
    const g = groupByMap([{ mapId: 2, v: "a" }, { mapId: 1, v: "b" }, { mapId: 2, v: "c" }]);
    expect([...g.keys()]).toEqual([2, 1]);
    expect(g.get(2)?.map((r) => r.v)).toEqual(["a", "c"]);
  });

  it("keeps the final round per map, not across maps", () => {
    const f = finalsByMap([stat(1, 1, "p", 3), stat(1, 2, "p", 7), stat(2, 1, "p", 4)]);
    expect(f.get(1)?.map((r) => r.eliminations)).toEqual([7]);
    expect(f.get(2)?.map((r) => r.eliminations)).toEqual([4]);
  });

  it("classifies outcomes and guards rates", () => {
    expect(outcome({ ourSide: 1, winnerSide: 1 })).toBe("won");
    expect(outcome({ ourSide: 2, winnerSide: 1 })).toBe("lost");
    expect(outcome({ ourSide: 2, winnerSide: null })).toBe("undecided");
    expect(rate(1, 4)).toBe(0.25);
    expect(rate(0, 0)).toBeNull();
  });
});
