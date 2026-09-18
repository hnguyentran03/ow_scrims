import { describe, expect, it } from "vitest";
import { ROLE_ORDER, roleOf } from "@/lib/stats/heroes";

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
