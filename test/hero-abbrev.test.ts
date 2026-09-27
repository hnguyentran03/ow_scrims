import { describe, expect, it } from "vitest";
import { heroAbbrev } from "@/lib/hero-abbrev";

describe("heroAbbrev", () => {
  it("uses the override table for collisions and the first two letters otherwise", () => {
    expect(heroAbbrev("Sombra")).toBe("SB");
    expect(heroAbbrev("Sojourn")).toBe("SJ");
    expect(heroAbbrev("Soldier: 76")).toBe("76");
    expect(heroAbbrev("Lúcio")).toBe("LU");
    expect(heroAbbrev("Kiriko")).toBe("KI");
    expect(heroAbbrev("")).toBe("??");
  });
});
