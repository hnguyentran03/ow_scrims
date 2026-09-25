import { describe, expect, it } from "vitest";
import { HEROES, ROLE_ORDER, roleOf } from "@/lib/stats/heroes";

describe("roleOf", () => {
  it("maps known heroes", () => {
    expect(roleOf("Orisa")).toBe("Tank");
    expect(roleOf("Soldier: 76")).toBe("Damage");
    expect(roleOf("Lúcio")).toBe("Support");
    expect(roleOf("Domina")).toBe("Tank");
  });
  it("falls back to Unknown, which sorts last", () => {
    expect(roleOf("Vendetta")).toBe("Unknown");
    expect(ROLE_ORDER).toEqual(["Tank", "Damage", "Support", "Unknown"]);
  });
});

describe("HEROES", () => {
  it("lists every known hero once, ordered by role then name", () => {
    expect(new Set(HEROES).size).toBe(HEROES.length);
    expect(HEROES).toContain("Ana");
    expect(HEROES.every((h) => roleOf(h) !== "Unknown")).toBe(true);
    const roles = HEROES.map((h) => ROLE_ORDER.indexOf(roleOf(h)));
    expect([...roles].sort((a, b) => a - b)).toEqual(roles);
    expect(HEROES[0]).toBe("D.Va");
  });
});
