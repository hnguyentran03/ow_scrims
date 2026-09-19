import { describe, expect, it } from "vitest";
import { aggregateRows, comparablePlayers, compareStats } from "@/lib/stats/compare";
import type { PlayerRow } from "@/lib/stats/overview";

const s = { ours: "Team 2", theirs: "Team 1" };
const row = (o: Partial<PlayerRow> & Pick<PlayerRow, "team" | "name" | "hero" | "role">): PlayerRow => ({
  timePlayed: 600, eliminations: 0, finalBlows: 0, deaths: 0, heroDamage: 0, healing: 0, damageTaken: 0, damageBlocked: 0, ultsEarned: 0, ultsUsed: 0,
  elimsPer10: 0, fbPer10: 0, deathsPer10: 0, damagePer10: 0, healingPer10: 0, ...o,
});
const players = [
  row({ team: "Team 1", name: "sup", hero: "Ana", role: "Support", eliminations: 10, deaths: 4, healing: 8000, timePlayed: 600, elimsPer10: 10, deathsPer10: 4, healingPer10: 8000 }),
  row({ team: "Team 2", name: "dps", hero: "Tracer", role: "Damage", eliminations: 12, deaths: 6, heroDamage: 6000, timePlayed: 300, elimsPer10: 24, deathsPer10: 12, damagePer10: 12000 }),
  row({ team: "Team 2", name: "dps", hero: "Genji", role: "Damage", eliminations: 6, deaths: 2, heroDamage: 3000, timePlayed: 300, elimsPer10: 12, deathsPer10: 4, damagePer10: 6000 }),
  row({ team: "Team 2", name: "tank", hero: "Orisa", role: "Tank", timePlayed: 600 }),
];

describe("comparablePlayers", () => {
  it("lists our team first, then role, with heroes by playtime", () => {
    expect(comparablePlayers(players, s)).toEqual([
      { team: "Team 2", name: "tank", role: "Tank", heroes: ["Orisa"] },
      { team: "Team 2", name: "dps", role: "Damage", heroes: ["Tracer", "Genji"] },
      { team: "Team 1", name: "sup", role: "Support", heroes: ["Ana"] },
    ]);
  });
});

describe("aggregateRows", () => {
  it("returns null for no rows and the row itself for one row", () => {
    expect(aggregateRows([])).toBeNull();
    expect(aggregateRows([players[0]])).toBe(players[0]);
  });

  it("sums totals across heroes and recomputes per-10 rates from the summed time", () => {
    const all = aggregateRows([players[1], players[2]])!;
    expect(all).toMatchObject({ team: "Team 2", name: "dps", hero: "Tracer, Genji", timePlayed: 600, eliminations: 18, deaths: 8, heroDamage: 9000, elimsPer10: 18, deathsPer10: 8, damagePer10: 9000 });
  });
});

describe("compareStats", () => {
  it("pairs stat lines and marks the better side, with deaths inverted and time neutral", () => {
    const lines = compareStats(players, { team: "Team 2", name: "dps" }, { team: "Team 1", name: "sup", hero: "Ana" });
    const by = Object.fromEntries(lines.map((l) => [l.label, l]));
    expect(by["Hero"]).toEqual({ label: "Hero", left: "Tracer, Genji", right: "Ana", better: null, format: "text" });
    expect(by["Time played"]).toMatchObject({ left: 600, right: 600, better: null, format: "duration" });
    expect(by["Eliminations"]).toMatchObject({ left: 18, right: 10, better: "left", format: "int" });
    expect(by["Deaths"]).toMatchObject({ left: 8, right: 4, better: "right" });
    expect(by["Deaths / 10"]).toMatchObject({ left: 8, right: 4, better: "right", format: "rate" });
    expect(by["Healing"]).toMatchObject({ left: 0, right: 8000, better: "right" });
    expect(lines).toHaveLength(17);
  });

  it("returns no lines when a selection matches nothing", () => {
    expect(compareStats(players, { team: "Team 2", name: "ghost" }, { team: "Team 1", name: "sup" })).toEqual([]);
  });
});
