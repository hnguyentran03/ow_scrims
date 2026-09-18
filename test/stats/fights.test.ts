import { describe, expect, it } from "vitest";
import { groupFights, type KillLike } from "@/lib/stats/fights";

const k = (matchTime: number, victimTeam: string, victimName: string): KillLike => ({
  matchTime,
  attackerTeam: victimTeam === "A" ? "B" : "A",
  attackerName: "x",
  victimTeam,
  victimName,
});

describe("groupFights", () => {
  it("returns no fights for no kills", () => {
    expect(groupFights([])).toEqual([]);
  });

  it("starts a new fight when the gap exceeds 15 seconds", () => {
    const fights = groupFights([k(10, "A", "a1"), k(20, "B", "b1"), k(35, "A", "a2"), k(50.1, "B", "b2"), k(52, "A", "a1")]);
    expect(fights.map((f) => f.kills.length)).toEqual([3, 2]);
    expect(fights[0]).toMatchObject({ start: 10, end: 35, firstDeath: { team: "A", name: "a1" } });
    expect(fights[1]).toMatchObject({ start: 50.1, end: 52, firstDeath: { team: "B", name: "b2" } });
  });

  it("treats a gap of exactly 15 seconds as the same fight", () => {
    expect(groupFights([k(0, "A", "a"), k(15, "B", "b")])).toHaveLength(1);
  });

  it("sorts kills by time before grouping", () => {
    const fights = groupFights([k(40, "B", "b"), k(0, "A", "a")]);
    expect(fights.map((f) => f.firstDeath.name)).toEqual(["a", "b"]);
  });
});
