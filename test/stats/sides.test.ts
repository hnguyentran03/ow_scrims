import { describe, expect, it } from "vitest";
import { sideOf, sides } from "@/lib/stats/sides";

describe("sides", () => {
  it("maps team names by ourSide", () => {
    expect(sides({ team1Name: "A", team2Name: "B", ourSide: 1 })).toEqual({ ours: "A", theirs: "B" });
    expect(sides({ team1Name: "A", team2Name: "B", ourSide: 2 })).toEqual({ ours: "B", theirs: "A" });
  });

  it("classifies a team name", () => {
    const s = { ours: "A", theirs: "B" };
    expect(sideOf("A", s)).toBe("ours");
    expect(sideOf("B", s)).toBe("theirs");
    expect(sideOf("All Teams", s)).toBeNull();
  });
});
