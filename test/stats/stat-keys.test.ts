import { describe, expect, it } from "vitest";
import { STAT_KEYS, STAT_LABELS, statValue } from "@/lib/stats/stat-keys";
import type { PlayerStatLike } from "@/lib/stats/overview";

const row: PlayerStatLike = {
  roundNumber: 1, playerTeam: "A", playerName: "p", playerHero: "Ana", eliminations: 1, finalBlows: 2, deaths: 3, heroDamageDealt: 4, healingDealt: 5,
  healingReceived: 6, damageTaken: 7, damageBlocked: 8, ultimatesEarned: 9, ultimatesUsed: 10, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed: 600,
};

describe("stat catalogue", () => {
  it("labels every key in sentence case and keeps the player chart's order", () => {
    expect(STAT_KEYS).toEqual(["eliminations", "finalBlows", "deaths", "heroDamage", "healing", "healingReceived", "damageTaken", "damageBlocked", "ultsEarned", "ultsUsed"]);
    expect(STAT_LABELS.healingReceived).toBe("Healing received");
    for (const k of STAT_KEYS) expect(STAT_LABELS[k]).toMatch(/^[A-Z][a-z]/);
  });

  it("reads each key off a row", () => {
    expect(STAT_KEYS.map((k) => statValue(row, k))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
