import { describe, expect, it } from "vitest";
import { damageByRound, finalBlowsByRole, killsByFight } from "@/lib/stats/charts";
import { groupFights, type KillLike } from "@/lib/stats/fights";

const s = { ours: "Team 2", theirs: "Team 1" };
const kill = (matchTime: number, attackerTeam: string, attackerHero: string, victimTeam = attackerTeam === "Team 1" ? "Team 2" : "Team 1", extra: Partial<KillLike> = {}): KillLike => ({
  matchTime, attackerTeam, attackerName: `${attackerTeam}-${attackerHero}`, attackerHero, victimTeam, victimName: "v", victimHero: "Ana", ...extra,
});

describe("killsByFight", () => {
  it("emits a spike per fight, ours positive and theirs as a count, reset one second later", () => {
    const fights = groupFights([kill(10, "Team 2", "Ana"), kill(12, "Team 2", "Ana"), kill(13, "Team 1", "Genji"), kill(100, "Team 1", "Genji")]);
    expect(killsByFight(fights, s)).toEqual([
      { time: 0, ours: 0, theirs: 0, fightIndex: null, start: 0, end: 0 },
      { time: 13, ours: 2, theirs: 1, fightIndex: 1, start: 10, end: 13 },
      { time: 14, ours: 0, theirs: 0, fightIndex: null, start: 13, end: 14 },
      { time: 100, ours: 0, theirs: 1, fightIndex: 2, start: 100, end: 100 },
      { time: 101, ours: 0, theirs: 0, fightIndex: null, start: 100, end: 101 },
    ]);
  });

  it("returns only the origin for no fights", () => {
    expect(killsByFight([], s)).toEqual([{ time: 0, ours: 0, theirs: 0, fightIndex: null, start: 0, end: 0 }]);
  });
});

describe("finalBlowsByRole", () => {
  it("counts counted kills by attacker role and reports unknown heroes as dropped", () => {
    const kills = [
      kill(1, "Team 2", "Orisa"), kill(2, "Team 2", "Ana"), kill(3, "Team 1", "Genji"), kill(4, "Team 1", "Genji"),
      kill(5, "Team 1", "Genji", "Team 1", { attackerName: "v", victimName: "v" }),
      kill(6, "Team 1", "Nobody"),
    ];
    expect(finalBlowsByRole(kills, s)).toEqual({
      bars: [
        { role: "Tank", ours: 1, theirs: 0 },
        { role: "Damage", ours: 0, theirs: 2 },
        { role: "Support", ours: 1, theirs: 0 },
      ],
      dropped: 1,
    });
  });
});

describe("damageByRound", () => {
  it("sums hero damage per round per side after deduplicating repeated rows", () => {
    const row = (roundNumber: number, playerTeam: string, playerName: string, playerHero: string, heroDamageDealt: number) => ({ roundNumber, playerTeam, playerName, playerHero, heroDamageDealt });
    const stats = [
      row(1, "Team 1", "a", "Ana", 1000), row(1, "Team 2", "b", "Genji", 500),
      row(2, "Team 1", "a", "Ana", 2500), row(2, "Team 2", "b", "Genji", 900), row(2, "Team 2", "b", "Genji", 900),
    ];
    expect(damageByRound(stats, s)).toEqual([
      { roundNumber: 1, ours: 500, theirs: 1000 },
      { roundNumber: 2, ours: 900, theirs: 2500 },
    ]);
  });

  it("returns an empty series for no rows", () => {
    expect(damageByRound([], s)).toEqual([]);
  });
});
