import { describe, expect, it } from "vitest";
import { fightsByMap, type KillLike } from "@/lib/stats/fights";
import { buildPerformance, mainRoles, type KillRowLike, type UltRowLike } from "@/lib/stats/performance";
import type { MapKeyed, StatLike, TeamMapLike } from "@/lib/stats/team-rows";
import { sampleMapRows } from "./sample-rows";

const map = (id: number, over: Partial<TeamMapLike> = {}): TeamMapLike => ({
  id, scrimId: id, scrimName: `vs ${id}`, scrimDate: `2026-09-${String(10 + id).padStart(2, "0")}`, mapName: "Busan", mapType: "Control",
  team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600, ...over,
});
const stat = (mapId: number, playerName: string, playerHero: string, heroTimePlayed: number, over: Partial<StatLike> = {}): StatLike => ({
  mapId, roundNumber: 1, playerTeam: "A", playerName, playerHero, heroTimePlayed,
  eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, healingReceived: 0, damageTaken: 0, damageBlocked: 0,
  ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, ...over,
});
const kill = (mapId: number, matchTime: number, attackerTeam = "A", victimTeam = "B"): KillRowLike => ({
  mapId, matchTime, attackerTeam, attackerName: `${attackerTeam}p`, victimTeam, victimName: `${victimTeam}p`,
});
const ult = (mapId: number, matchTime: number, playerName: string, playerHero: string, playerTeam = "A"): UltRowLike => ({ mapId, matchTime, playerTeam, playerName, playerHero });

/** Five of ours on one map: Rein (tank), Tracer + Ashe (damage), Ana + Kiriko (support). */
const fiveStack = (mapId: number) => [
  stat(mapId, "T", "Reinhardt", 600, { finalBlows: 4, deaths: 2, heroDamageDealt: 6000, healingDealt: 0 }),
  stat(mapId, "D1", "Tracer", 600, { finalBlows: 10, deaths: 5, heroDamageDealt: 8000 }),
  stat(mapId, "D2", "Ashe", 600, { finalBlows: 6, deaths: 3, heroDamageDealt: 7000 }),
  stat(mapId, "S1", "Ana", 600, { finalBlows: 1, deaths: 4, healingDealt: 9000 }),
  stat(mapId, "S2", "Kiriko", 600, { finalBlows: 2, deaths: 1, healingDealt: 8000 }),
];

describe("mainRoles", () => {
  it("assigns the role with the most hero time and breaks ties toward the earlier role", () => {
    const roles = mainRoles([stat(1, "Flex", "Reinhardt", 200), stat(1, "Flex", "Tracer", 400), stat(1, "Tie", "Zarya", 300), stat(1, "Tie", "Ana", 300)]);
    expect(roles.get("Flex")).toBe("Damage");
    expect(roles.get("Tie")).toBe("Tank");
  });
  it("ignores rows with no hero time", () => {
    expect(mainRoles([stat(1, "P", "Ana", 0)]).size).toBe(0);
  });
});

describe("buildPerformance roles", () => {
  it("sums each role over our side's final rows and rates per 10 minutes of role time", () => {
    const p = buildPerformance([map(1)], fiveStack(1), fightsByMap([]), [], []);
    expect(p.roles.map((r) => r.role)).toEqual(["Tank", "Damage", "Support"]);
    const damage = p.roles[1];
    expect(damage).toMatchObject({ playtime: 1200, maps: 1, kd: 2, damagePer10: 7500, healingPer10: 0, deathsPer10: 4, casts: 0, ultEfficiency: null });
  });
  it("credits a flexed player's whole map to their main role and gives null K/D with no deaths", () => {
    const rows = [stat(1, "Flex", "Reinhardt", 200, { finalBlows: 1, deaths: 0 }), stat(1, "Flex", "Tracer", 400, { finalBlows: 3, deaths: 0 })];
    const p = buildPerformance([map(1)], rows, fightsByMap([]), [], []);
    expect(p.roles).toHaveLength(1);
    expect(p.roles[0]).toMatchObject({ role: "Damage", playtime: 600, kd: null });
  });
  it("returns no roles for no maps", () => {
    expect(buildPerformance([], [], fightsByMap([]), [], [])).toEqual({ roles: [] });
  });
  it("ignores the other side and skips roles with no time", () => {
    const p = buildPerformance([map(1)], [stat(1, "Enemy", "Ana", 600, { playerTeam: "B" }), stat(1, "Ours", "Tracer", 600)], fightsByMap([]), [], []);
    expect(p.roles.map((r) => r.role)).toEqual(["Damage"]);
  });
  it("rates ult efficiency as casts in won fights over casts, attributing casts like the teamfights tab", () => {
    // Fight 1 at 10–11 won by A; fight 2 at 50–51 won by B; a cast at 200 has no fight.
    const kills = [kill(1, 10), kill(1, 11), kill(1, 50, "B", "A"), kill(1, 51, "B", "A")];
    const starts = [ult(1, 9, "T", "Reinhardt"), ult(1, 50.5, "T", "Reinhardt"), ult(1, 200, "S1", "Ana"), ult(1, 10.5, "E", "Ana", "B")];
    const p = buildPerformance([map(1)], fiveStack(1), fightsByMap(kills), starts, []);
    const by = Object.fromEntries(p.roles.map((r) => [r.role, r]));
    expect(by.Tank).toMatchObject({ casts: 2, ultEfficiency: 0.5 });
    expect(by.Support).toMatchObject({ casts: 1, ultEfficiency: 0 });
    expect(by.Damage).toMatchObject({ casts: 0, ultEfficiency: null });
  });
});

describe("buildPerformance on a sample log", () => {
  it("pins the Antarctic Peninsula role cards", () => {
    const s = sampleMapRows("Log-2026-04-15-21-12-58", 1, 1);
    const p = buildPerformance([s.map], s.playerStats, fightsByMap(s.kills as (KillLike & MapKeyed)[]), s.starts, s.ends);
    expect(p.roles.map((r) => r.role)).toEqual(["Tank", "Damage", "Support"]);
    for (const r of p.roles) {
      expect(r.maps).toBe(1);
      expect(r.playtime).toBeGreaterThan(0);
      expect(r.casts).toBeGreaterThan(0);
    }
  });
});
