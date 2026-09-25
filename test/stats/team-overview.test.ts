import { describe, expect, it } from "vitest";
import { buildTeamOverview } from "@/lib/stats/team-overview";
import type { StatLike, TeamMapLike } from "@/lib/stats/team-rows";

const map = (id: number, mapName: string, winnerSide: number | null, scrimId = 1): TeamMapLike => ({
  id, scrimId, scrimName: `s${scrimId}`, scrimDate: `2026-09-${String(scrimId).padStart(2, "0")}`, mapName, mapType: "Control", team1Name: "A", team2Name: "B", ourSide: 1, winnerSide, durationSeconds: 600,
});
const stat = (mapId: number, playerTeam: string, playerHero: string, finalBlows: number, deaths: number, heroDamageDealt: number, healingDealt: number): StatLike => ({
  mapId, roundNumber: 1, playerTeam, playerName: playerHero, playerHero, eliminations: 0, finalBlows, deaths, heroDamageDealt, healingDealt, damageTaken: 0, damageBlocked: 0,
  ultimatesEarned: 0, ultimatesUsed: 0, heroTimePlayed: 100,
});

describe("buildTeamOverview", () => {
  it("is empty-safe", () => {
    expect(buildTeamOverview([], [])).toEqual({
      record: { won: 0, lost: 0, undecided: 0, maps: 0, scrims: 0 }, lastTen: { won: 0, lost: 0 }, strongest: null, blindSpot: null, strongestType: null, blindSpotType: null,
      roleBalance: [
        { role: "Tank", finalBlows: null, deaths: null, heroDamage: null, healing: null },
        { role: "Damage", finalBlows: null, deaths: null, heroDamage: null, healing: null },
        { role: "Support", finalBlows: null, deaths: null, heroDamage: null, healing: null },
      ],
    });
  });

  it("counts the record over the range and the last ten decided maps in order", () => {
    // 12 maps across 12 scrims: first two won, then ten alternating L/W, final map undecided.
    const maps = [map(1, "Busan", 1, 1), map(2, "Busan", 1, 2)];
    for (let i = 3; i <= 12; i += 1) maps.push(map(i, "Ilios", i % 2 === 0 ? 1 : 2, i));
    maps.push(map(13, "Nepal", null, 13));
    const o = buildTeamOverview(maps, []);
    expect(o.record).toEqual({ won: 7, lost: 5, undecided: 1, maps: 13, scrims: 13 });
    expect(o.lastTen).toEqual({ won: 5, lost: 5 });
  });

  it("needs three plays for strongest and blind-spot maps and breaks ties by plays then name", () => {
    const maps = [
      map(1, "Busan", 1), map(2, "Busan", 1), map(3, "Busan", 2),
      map(4, "Ilios", 2), map(5, "Ilios", 2), map(6, "Ilios", 1), map(7, "Ilios", 2),
      map(8, "Nepal", 1), map(9, "Nepal", 1),
      map(10, "Oasis", null), map(11, "Oasis", null), map(12, "Oasis", null),
    ];
    const o = buildTeamOverview(maps, []);
    expect(o.strongest?.mapName).toBe("Busan");
    expect(o.blindSpot?.mapName).toBe("Ilios");
    expect(buildTeamOverview(maps.slice(0, 2), []).strongest).toBeNull();
    const one = buildTeamOverview(maps.slice(0, 3), []);
    expect(one.strongest?.mapName).toBe("Busan");
    expect(one.blindSpot?.mapName).toBe("Busan");
  });

  it("shares our final blows, deaths, damage, and healing by role", () => {
    const maps = [map(1, "Busan", 1), map(2, "Ilios", 1, 2)];
    const stats = [
      stat(1, "A", "Reinhardt", 2, 4, 1000, 0), stat(1, "A", "Genji", 6, 2, 3000, 0), stat(1, "A", "Ana", 2, 2, 1000, 5000),
      stat(2, "A", "Reinhardt", 0, 2, 1000, 0), stat(2, "B", "Ana", 9, 9, 9000, 9000),
    ];
    const o = buildTeamOverview(maps, stats);
    expect(o.roleBalance).toEqual([
      { role: "Tank", finalBlows: 0.2, deaths: 0.6, heroDamage: 1 / 3, healing: 0 },
      { role: "Damage", finalBlows: 0.6, deaths: 0.2, heroDamage: 0.5, healing: 0 },
      { role: "Support", finalBlows: 0.2, deaths: 0.2, heroDamage: 1 / 6, healing: 1 },
    ]);
  });

  it("adds an Unknown row only when an unknown hero appears", () => {
    const o = buildTeamOverview([map(1, "Busan", 1)], [stat(1, "A", "Mystery", 1, 1, 1, 1)]);
    expect(o.roleBalance.map((r) => r.role)).toEqual(["Tank", "Damage", "Support", "Unknown"]);
    expect(o.roleBalance[3].finalBlows).toBe(1);
  });
});

describe("strongest and blind-spot game modes", () => {
  const typed = (id: number, mapName: string, mapType: string, winnerSide: number | null): TeamMapLike => ({ ...map(id, mapName, winnerSide, id), mapType });

  it("applies the same 3-play guard per map type and orders by win rate", () => {
    const maps = [
      typed(1, "Busan", "Control", 1), typed(2, "Ilios", "Control", 1), typed(3, "Nepal", "Control", 2),
      typed(4, "Kings Row", "Hybrid", 2), typed(5, "Eichenwalde", "Hybrid", 2), typed(6, "Numbani", "Hybrid", 1),
      typed(7, "Colosseo", "Push", 1), typed(8, "Esperanca", "Push", 1),
    ];
    const o = buildTeamOverview(maps, []);
    expect(o.strongestType).toMatchObject({ mapType: "Control", played: 3, winRate: 2 / 3 });
    expect(o.blindSpotType).toMatchObject({ mapType: "Hybrid", played: 3, winRate: 1 / 3 });
  });

  it("uses the only qualifying type for both and nulls when none qualifies", () => {
    const maps = [typed(1, "Busan", "Control", 1), typed(2, "Ilios", "Control", 2), typed(3, "Nepal", "Control", 2), typed(4, "Colosseo", "Push", 1)];
    const o = buildTeamOverview(maps, []);
    expect(o.strongestType?.mapType).toBe("Control");
    expect(o.blindSpotType?.mapType).toBe("Control");
    expect(buildTeamOverview(maps.slice(0, 2), []).strongestType).toBeNull();
  });
});
