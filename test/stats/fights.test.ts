import { describe, expect, it } from "vitest";
import { fightsByMap, groupFights, killKind, type KillLike } from "@/lib/stats/fights";

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

describe("fight scoring", () => {
  const kill = (matchTime: number, attackerTeam: string, attackerName: string, victimTeam: string, victimName: string, extra: Partial<KillLike> = {}): KillLike => ({
    matchTime, attackerTeam, attackerName, victimTeam, victimName, ...extra,
  });

  it("numbers fights from 1 and counts kills per team", () => {
    const [f] = groupFights([kill(1, "A", "a1", "B", "b1"), kill(2, "A", "a2", "B", "b2"), kill(3, "B", "b1", "A", "a1")]);
    expect(f.index).toBe(1);
    expect(f.killsByTeam).toEqual({ A: 2, B: 1 });
    expect(f.winner).toBe("A");
  });

  it("returns null winner on a tie", () => {
    const [f] = groupFights([kill(1, "A", "a1", "B", "b1"), kill(2, "B", "b1", "A", "a1")]);
    expect(f.winner).toBeNull();
  });

  it("does not count suicides or environmental kills for anyone, but keeps both teams in the record", () => {
    const [f] = groupFights([
      kill(1, "A", "a1", "A", "a1"),
      kill(2, "B", "b1", "B", "b1", { isEnvironmental: "True" }),
      kill(3, "B", "b2", "A", "a2"),
    ]);
    expect(f.killsByTeam).toEqual({ A: 0, B: 1 });
    expect(f.winner).toBe("B");
  });

  it("classifies kill kinds", () => {
    expect(killKind(kill(1, "A", "a", "B", "b"))).toBe("kill");
    expect(killKind(kill(1, "A", "a", "A", "a"))).toBe("suicide");
    expect(killKind(kill(1, "A", "a", "A", "a", { isEnvironmental: "True" }))).toBe("environmental");
    expect(killKind(kill(1, "A", "0", "B", "0"))).toBe("kill");
  });
});

describe("fightsByMap", () => {
  it("groups fights per map and leaves maps without kills absent", () => {
    const row = (mapId: number, matchTime: number) => ({ mapId, matchTime, attackerTeam: "A", attackerName: "a", victimTeam: "B", victimName: "b" });
    const by = fightsByMap([row(2, 5), row(1, 10), row(1, 100), row(2, 6)]);
    expect([...by.keys()].sort()).toEqual([1, 2]);
    expect(by.get(1)!.map((f) => f.index)).toEqual([1, 2]);
    expect(by.get(2)).toHaveLength(1);
    expect(by.get(3)).toBeUndefined();
  });
});
