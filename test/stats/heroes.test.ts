import { describe, expect, it } from "vitest";
import { HERO_ABILITIES, HEROES, ROLE_ORDER, abilityName, roleOf } from "@/lib/stats/heroes";

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

describe("HERO_ABILITIES", () => {
  it("names only heroes that have a role, in Shift then E order", () => {
    for (const hero of Object.keys(HERO_ABILITIES)) expect(roleOf(hero)).not.toBe("Unknown");
    expect(HERO_ABILITIES.Tracer).toEqual(["Blink", "Recall"]);
    expect(HERO_ABILITIES.Kiriko).toEqual(["Swift Step", "Protection Suzu"]);
  });
  it("falls back to the slot label for an unnamed hero and for a censored hero", () => {
    expect(abilityName("Tracer", 1)).toBe("Blink");
    expect(abilityName("Tracer", 2)).toBe("Recall");
    expect(abilityName("Wrecking Ball", 1)).toBe("Ability 1");
    expect(abilityName("0", 2)).toBe("Ability 2");
    expect(abilityName("Emre", 1)).toBe("Ability 1");
  });
});
