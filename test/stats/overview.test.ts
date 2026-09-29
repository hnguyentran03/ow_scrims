import { describe, expect, it } from "vitest";
import { buildOverview, finalRoundRows, per10, type PlayerStatLike } from "@/lib/stats/overview";

const stat = (o: Partial<PlayerStatLike> & Pick<PlayerStatLike, "playerTeam" | "playerName" | "playerHero">): PlayerStatLike => ({
  roundNumber: 1, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, damageTaken: 0,
  damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed: 600, ...o,
});

describe("per10", () => {
  it("scales a value to a 10-minute rate", () => {
    expect(per10(30, 600)).toBe(30);
    expect(per10(15, 300)).toBe(30);
    expect(per10(5, 0)).toBe(0);
  });
});

describe("finalRoundRows", () => {
  it("keeps the highest round per team, player, and hero", () => {
    const rows = finalRoundRows([
      stat({ playerTeam: "A", playerName: "p", playerHero: "Ana", roundNumber: 1, eliminations: 3 }),
      stat({ playerTeam: "A", playerName: "p", playerHero: "Ana", roundNumber: 2, eliminations: 7 }),
      stat({ playerTeam: "A", playerName: "p", playerHero: "Kiriko", roundNumber: 2, eliminations: 1 }),
    ]);
    expect(rows.map((r) => [r.playerHero, r.eliminations])).toEqual([["Ana", 7], ["Kiriko", 1]]);
  });

  it("keeps the later row when two snapshots share the same round number", () => {
    const rows = finalRoundRows([
      stat({ playerTeam: "A", playerName: "p", playerHero: "Ana", roundNumber: 5, eliminations: 2 }),
      stat({ playerTeam: "A", playerName: "p", playerHero: "Ana", roundNumber: 5, eliminations: 3 }),
    ]);
    expect(rows.map((r) => r.eliminations)).toEqual([3]);
  });
});

describe("buildOverview", () => {
  const playerStats = [
    stat({ playerTeam: "Team 1", playerName: "tank", playerHero: "Orisa", eliminations: 20, finalBlows: 8, deaths: 4, heroDamageDealt: 9000, damageBlocked: 3000, heroTimePlayed: 600 }),
    stat({ playerTeam: "Team 1", playerName: "sup", playerHero: "Ana", healingDealt: 8000, heroTimePlayed: 600 }),
    stat({ playerTeam: "Team 1", playerName: "sup", playerHero: "Wrecking Ball", heroTimePlayed: 0 }),
    stat({ playerTeam: "Team 2", playerName: "dps", playerHero: "Tracer", eliminations: 10, finalBlows: 10, deaths: 10, heroDamageDealt: 5000, heroTimePlayed: 300 }),
    stat({ playerTeam: "Team 2", playerName: "dps", playerHero: "Genji", eliminations: 5, heroDamageDealt: 2000, heroTimePlayed: 300 }),
  ];
  const kills = [
    { matchTime: 10, attackerTeam: "Team 2", attackerName: "dps", victimTeam: "Team 1", victimName: "sup" },
    { matchTime: 12, attackerTeam: "Team 1", attackerName: "tank", victimTeam: "Team 2", victimName: "dps" },
    { matchTime: 100, attackerTeam: "Team 2", attackerName: "dps", victimTeam: "Team 1", victimName: "sup" },
    { matchTime: 200, attackerTeam: "Team 1", attackerName: "tank", victimTeam: "Team 2", victimName: "dps" },
  ];
  const overview = buildOverview({ team1Name: "Team 1", team2Name: "Team 2", ourTeam: "Team 2", playerStats, kills });

  it("sums team hero damage and healing from final-round rows", () => {
    expect(overview.teamTotals).toEqual([
      { team: "Team 1", heroDamage: 9000, healing: 8000 },
      { team: "Team 2", heroDamage: 7000, healing: 0 },
    ]);
  });

  it("drops zero-playtime rows and orders our team first, then role, then name", () => {
    expect(overview.players.map((p) => `${p.team}/${p.hero}`)).toEqual(["Team 2/Tracer", "Team 2/Genji", "Team 1/Orisa", "Team 1/Ana"]);
  });

  it("computes per-10 rates from each row's own playtime", () => {
    const tracer = overview.players.find((p) => p.hero === "Tracer")!;
    expect(tracer).toMatchObject({ role: "Damage", elimsPer10: 20, fbPer10: 20, deathsPer10: 20, damagePer10: 10000 });
  });

  it("computes fight and first-death analysis", () => {
    expect(overview.analysis.fights).toBe(3);
    expect(overview.analysis.firstDeathPct["Team 1"]).toBeCloseTo(2 / 3, 10);
    expect(overview.analysis.firstDeathPct["Team 2"]).toBeCloseTo(1 / 3, 10);
    expect(overview.analysis.mostFirstDeaths).toEqual({ team: "Team 1", name: "sup", count: 2 });
  });
});
