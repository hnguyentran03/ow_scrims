import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildTelemetry, type DamageLike } from "@/lib/stats/telemetry";
import type { PlayerStatLike } from "@/lib/stats/overview";
import { parseLog } from "@/lib/parser/parse";

const map = { team1Name: "Team 1", team2Name: "Team 2", ourSide: 1 };
const stat = (playerTeam: string, playerName: string, playerHero: string, extra: Partial<PlayerStatLike> = {}): PlayerStatLike => ({
  roundNumber: 1, playerTeam, playerName, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0,
  damageTaken: 0, damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, heroTimePlayed: 600, ...extra,
});
const dmg = (attackerTeam: string, attackerName: string, attackerHero: string, victimTeam: string, victimName: string, victimHero: string, eventDamage: number): DamageLike => ({
  attackerTeam, attackerName, attackerHero, victimTeam, victimName, victimHero, eventDamage,
});
const sample = (name: string) => {
  const ev = parseLog(readFileSync(`test/samples/${name}.txt`, "utf8")).events;
  return { damage: (ev.damage ?? []) as unknown as DamageLike[], playerStats: (ev.player_stat ?? []) as unknown as PlayerStatLike[] };
};

describe("buildTelemetry lanes and focus fire", () => {
  const stats = [stat("Team 1", "a", "Mei"), stat("Team 2", "x", "Genji"), stat("Team 2", "y", "Ana")];

  it("drops same-team rows and reports whether any damage remains", () => {
    const t = buildTelemetry({ map, damage: [dmg("Team 1", "a", "Mei", "Team 1", "a", "Mei", 50)], playerStats: stats });
    expect(t.hasDamage).toBe(false);
    expect(t.players[0].dealt).toEqual([]);
  });

  it("sorts lanes by damage with shares of the player's total", () => {
    const damage = [
      dmg("Team 1", "a", "Mei", "Team 2", "y", "Ana", 30),
      dmg("Team 1", "a", "Mei", "Team 2", "x", "Genji", 70),
      dmg("Team 1", "a", "Mei", "Team 2", "y", "Ana", 20),
      dmg("Team 2", "x", "Genji", "Team 1", "a", "Mei", 10),
    ];
    const a = buildTelemetry({ map, damage, playerStats: stats }).players.find((p) => p.name === "a")!;
    expect(a.dealt).toEqual([{ hero: "Genji", damage: 70, share: 70 / 120 }, { hero: "Ana", damage: 50, share: 50 / 120 }]);
    expect(a.received).toEqual([{ hero: "Genji", damage: 10, share: 1 }]);
  });

  it("splits focus fire by role over every role, zeros included", () => {
    const damage = [
      dmg("Team 1", "a", "Mei", "Team 2", "y", "Ana", 50),
      dmg("Team 1", "a", "Mei", "Team 2", "x", "Genji", 70),
      dmg("Team 2", "x", "Genji", "Team 1", "a", "Mei", 10),
    ];
    const a = buildTelemetry({ map, damage, playerStats: stats }).players.find((p) => p.name === "a")!;
    expect(a.focusFire.received).toEqual([
      { role: "Tank", damage: 0, share: 0 }, { role: "Damage", damage: 10, share: 1 }, { role: "Support", damage: 0, share: 0 }, { role: "Unknown", damage: 0, share: 0 },
    ]);
    expect(a.focusFire.dealt.map((r) => [r.role, r.damage])).toEqual([["Tank", 0], ["Damage", 70], ["Support", 50], ["Unknown", 0]]);
    expect(a.focusFire.dealt[1].share).toBeCloseTo(70 / 120, 9);
  });

  it("orders players ours first by time, sums heroes, picks role and hero by time, and drops zero-time rows", () => {
    const stats2 = [
      stat("Team 2", "x", "Genji", { heroTimePlayed: 300, eliminations: 3 }),
      stat("Team 2", "x", "Ana", { heroTimePlayed: 400, eliminations: 4 }),
      stat("Team 1", "b", "Zarya", { heroTimePlayed: 100 }),
      stat("Team 1", "a", "Mei"),
      stat("Team 1", "z", "Ana", { heroTimePlayed: 0 }),
    ];
    const players = buildTelemetry({ map, damage: [], playerStats: stats2 }).players;
    expect(players.map((p) => [p.name, p.side, p.role, p.hero, p.timePlayed])).toEqual([
      ["a", "ours", "Damage", "Mei", 600],
      ["b", "ours", "Tank", "Zarya", 100],
      ["x", "theirs", "Support", "Ana", 700],
    ]);
  });

  it("finds Cassidy's top lanes in the Aatlis sample", () => {
    const t = buildTelemetry({ map: { ...map, ourSide: 2 }, ...sample("Log-2026-09-18-13-52-18") });
    expect(t.hasDamage).toBe(true);
    const cassidy = t.players.find((p) => p.name === "Cassidy" && p.team === "Team 2")!;
    expect(cassidy.side).toBe("ours");
    expect(cassidy.dealt[0].hero).toBe("Doomfist");
    expect(cassidy.dealt[0].damage).toBeCloseTo(2700.92, 1);
    expect(cassidy.received[0].hero).toBe("Bastion");
    expect(cassidy.received[0].damage).toBeCloseTo(1104.27, 1);
  });
});
