import { describe, expect, it } from "vitest";
import { HERO_ABILITIES, HEROES, ROLE_ORDER, abilityName, canonicalHero, roleOf } from "@/lib/stats/heroes";

describe("roleOf", () => {
  it("maps known heroes", () => {
    expect(roleOf("Orisa")).toBe("Tank");
    expect(roleOf("Soldier: 76")).toBe("Damage");
    expect(roleOf("Lúcio")).toBe("Support");
    expect(roleOf("Domina")).toBe("Tank");
    expect(roleOf("D.Mon")).toBe("Tank");
    expect(roleOf("Anran")).toBe("Damage");
    expect(roleOf("Shion")).toBe("Damage");
    expect(roleOf("Jetpack Cat")).toBe("Support");
    expect(roleOf("Mizuki")).toBe("Support");
  });
  it("falls back to Unknown, which sorts last", () => {
    expect(roleOf("Vendetta")).toBe("Damage");
    expect(roleOf("Nobody")).toBe("Unknown");
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
    expect(HEROES[0]).toBe("D.Mon");
    expect(HEROES).toHaveLength(53);
  });
});

describe("HERO_ABILITIES", () => {
  it("names every hero that has a role, in Shift then E order", () => {
    expect(Object.keys(HERO_ABILITIES).sort()).toEqual([...HEROES].sort());
    expect(HERO_ABILITIES.Tracer).toEqual(["Blink", "Recall"]);
    expect(HERO_ABILITIES.Kiriko).toEqual(["Swift Step", "Protection Suzu"]);
  });
  it("falls back to the slot label for an unnamed hero and for a censored hero", () => {
    expect(abilityName("Tracer", 1)).toBe("Blink");
    expect(abilityName("Tracer", 2)).toBe("Recall");
    expect(abilityName("Jetpack Cat", 1)).toBe("Lifeline");
    expect(abilityName("Nobody", 1)).toBe("Ability 1");
    expect(abilityName("0", 2)).toBe("Ability 2");
  });
});

describe("canonicalHero", () => {
  it("restores the known spelling whatever the case and passes unknown names through", () => {
    expect(canonicalHero("D.VA")).toBe("D.Va");
    expect(canonicalHero("soldier: 76")).toBe("Soldier: 76");
    expect(canonicalHero(" Lúcio ")).toBe("Lúcio");
    expect(canonicalHero("Newhero")).toBe("Newhero");
  });
});
