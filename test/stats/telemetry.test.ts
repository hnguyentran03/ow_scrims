import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildTelemetry, type DamageLike } from "@/lib/stats/telemetry";
import type { PlayerStatLike } from "@/lib/stats/overview";
import { parseLog } from "@/lib/parser/parse";

const map = { team1Name: "Team 1", team2Name: "Team 2", ourSide: 1 };
const stat = (playerTeam: string, playerName: string, playerHero: string, extra: Partial<PlayerStatLike> = {}): PlayerStatLike => ({
  roundNumber: 1, playerTeam, playerName, playerHero, eliminations: 0, finalBlows: 0, deaths: 0, heroDamageDealt: 0, healingDealt: 0, healingReceived: 0,
  damageTaken: 0, damageBlocked: 0, ultimatesEarned: 0, ultimatesUsed: 0, multikillBest: 0, soloKills: 0, objectiveKills: 0, heroTimePlayed: 600, ...extra,
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

  it("breaks a role tie by ROLE_ORDER and a hero tie by name", () => {
    const stats2 = [
      stat("Team 1", "a", "Zarya", { heroTimePlayed: 300 }),
      stat("Team 1", "a", "Genji", { heroTimePlayed: 300 }),
    ];
    const a = buildTelemetry({ map, damage: [], playerStats: stats2 }).players.find((p) => p.name === "a")!;
    expect(a.role).toBe("Tank");
    expect(a.hero).toBe("Genji");
    expect(a.timePlayed).toBe(600);
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

describe("buildTelemetry radar", () => {
  it("picks the enemy with the most time in the player's role, ties by name", () => {
    const stats = [
      stat("Team 1", "a", "Zarya"),
      stat("Team 2", "y", "Orisa", { heroTimePlayed: 300 }),
      stat("Team 2", "x", "Orisa", { heroTimePlayed: 300 }),
      stat("Team 2", "w", "Genji"),
    ];
    const a = buildTelemetry({ map, damage: [], playerStats: stats }).players.find((p) => p.name === "a")!;
    expect(a.radar.opponent).toEqual({ name: "x", hero: "Orisa", role: "Tank" });
  });

  it("uses a role-specific fifth axis", () => {
    const stats = [
      stat("Team 1", "s", "Ana", { healingDealt: 6000 }), stat("Team 2", "s2", "Kiriko", { healingDealt: 3000 }),
      stat("Team 1", "t", "Zarya", { damageBlocked: 1200 }), stat("Team 2", "t2", "Orisa", { damageBlocked: 600 }),
      stat("Team 1", "d", "Genji", { damageTaken: 900 }), stat("Team 2", "d2", "Tracer", { damageTaken: 300 }),
    ];
    const players = buildTelemetry({ map, damage: [], playerStats: stats }).players;
    const axis = (name: string) => players.find((p) => p.name === name)!.radar.axes[4];
    expect(axis("s")).toEqual({ label: "Healing", player: 6000, opponent: 3000, max: 6000 });
    expect(axis("t")).toEqual({ label: "Blocked", player: 1200, opponent: 600, max: 1200 });
    expect(axis("d")).toEqual({ label: "Damage taken", player: 900, opponent: 300, max: 900 });
    expect(players.find((p) => p.name === "s")!.radar.axes.map((x) => x.label)).toEqual(["Elims", "Final blows", "Hero damage", "Deaths", "Healing"]);
  });

  it("scales per 10 minutes and falls back to a max of 1 when both values are zero", () => {
    const stats = [stat("Team 1", "a", "Genji", { eliminations: 10 }), stat("Team 2", "x", "Tracer", { heroTimePlayed: 300, eliminations: 5 })];
    const a = buildTelemetry({ map, damage: [], playerStats: stats }).players.find((p) => p.name === "a")!;
    expect(a.radar.axes[0]).toEqual({ label: "Elims", player: 10, opponent: 10, max: 10 });
    expect(a.radar.axes[3]).toEqual({ label: "Deaths", player: 0, opponent: 0, max: 1 });
  });

  it("resolves the Unknown-role bucket for an off-list hero", () => {
    const stats = [
      stat("Team 1", "d", "Nobody", { damageTaken: 900 }),
      stat("Team 2", "d2", "Nobody", { damageTaken: 300 }),
    ];
    const d = buildTelemetry({ map, damage: [], playerStats: stats }).players.find((p) => p.name === "d")!;
    expect(d.radar.opponent?.role).toBe("Unknown");
    expect(d.radar.axes[4]).toEqual({ label: "Damage taken", player: 900, opponent: 300, max: 900 });
  });

  it("has no opponent when nobody on the other team played the role", () => {
    const stats = [stat("Team 1", "a", "Genji", { eliminations: 10 }), stat("Team 2", "x", "Ana")];
    const a = buildTelemetry({ map, damage: [], playerStats: stats }).players.find((p) => p.name === "a")!;
    expect(a.radar.opponent).toBeNull();
    expect(a.radar.axes[0]).toEqual({ label: "Elims", player: 10, opponent: 0, max: 10 });
  });

  it("matches MomoMiles against StellBell in the Antarctic sample, which has no damage rows", () => {
    const t = buildTelemetry({ map, ...sample("Log-2026-04-15-21-12-58") });
    expect(t.hasDamage).toBe(false);
    expect(t.players).toHaveLength(10);
    const momo = t.players.find((p) => p.name === "MomoMiles")!;
    expect(momo.radar.opponent).toEqual({ name: "StellBell", hero: "Domina", role: "Tank" });
    expect(momo.radar.axes[0].player).toBeCloseTo(20.88, 1);
    expect(momo.radar.axes[0].opponent).toBeCloseTo(10.89, 1);
    expect(momo.radar.axes[4].label).toBe("Blocked");
  });
});

describe("radar counterpart in role", () => {
  it("measures a flex enemy by their time in the player's role and labels them with that role's hero", () => {
    const stats = [
      stat("Team 1", "me", "Reinhardt", { heroDamageDealt: 1000 }),
      stat("Team 2", "flex", "Zarya", { heroTimePlayed: 400, heroDamageDealt: 2000, deaths: 2 }),
      stat("Team 2", "flex", "Tracer", { heroTimePlayed: 200, heroDamageDealt: 9000, deaths: 10 }),
    ];
    const t = buildTelemetry({ map, damage: [], playerStats: stats });
    const me = t.players.find((p) => p.name === "me")!;
    expect(me.radar.opponent).toEqual({ name: "flex", hero: "Zarya", role: "Tank" });
    const damage = me.radar.axes.find((a) => a.label === "Hero damage")!;
    expect(damage.opponent).toBe(3000); // 2000 over 400 s, per 10 minutes
    const deaths = me.radar.axes.find((a) => a.label === "Deaths")!;
    expect(deaths.opponent).toBe(3);
  });
});
