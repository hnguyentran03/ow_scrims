import { describe, expect, it } from "vitest";
import { coerceRow, isEventType } from "@/lib/parser/coerce";
import { ParseError } from "@/lib/parser/errors";

describe("coerceRow", () => {
  it("coerces a kill line with positions", () => {
    const row = coerceRow("kill", ["32.06", "Team 2", "parrot", "Zarya", "Team 1", "H1dd3n", "Lúcio", "Secondary Fire", "22.52", "0", "0", "0", "(6.38, 270.00, 295.06)", "(8.44, 271.11, 301.84)"], 7);
    expect(row).toMatchObject({ matchTime: 32.06, attackerTeam: "Team 2", eventDamage: 22.52, assistCount: "0", attackerPosition: "(6.38, 270.00, 295.06)" });
  });

  it("canonicalises hero spellings in every hero column", () => {
    const row = coerceRow("kill", ["18.45", "Team 1", "RBM", "BRIGITTE", "Team 2", "Spingar", "tracer", "Ability 1", "53.03", "0", "0"], 1);
    expect(row).toMatchObject({ attackerHero: "Brigitte", victimHero: "Tracer" });
  });

  it("fills absent optional columns with null (older kill line)", () => {
    const row = coerceRow("kill", ["18.45", "Team 1", "RBM", "Brigitte", "Team 2", "Spingar", "Tracer", "Ability 1", "53.03", "0", "0"], 1);
    expect(row.assistCount).toBeNull();
    expect(row.attackerPosition).toBeNull();
    expect(row.victimPosition).toBeNull();
  });

  it("stores non-tuple position values as null", () => {
    const row = coerceRow("ultimate_start", ["106.54", "Team 2", "Boop", "Moira", "0", "1", "2}"], 1);
    expect(row.playerPosition).toBeNull();
    const zero = coerceRow("ultimate_start", ["106.54", "Team 2", "Boop", "Moira", "0", "1", "0"], 1);
    expect(zero.playerPosition).toBeNull();
  });

  it("turns an empty nullable integer into null", () => {
    const row = coerceRow("hero_spawn", ["0", "Team 2", "Spingar", "Sojourn", "", "0"], 1);
    expect(row.previousHero).toBeNull();
    expect(row.heroTimePlayed).toBe(0);
  });

  it("rejects non-integers in integer columns and NaN in real columns", () => {
    expect(() => coerceRow("match_end", ["958.15", "3.5", "1", "2"], 4)).toThrow(ParseError);
    expect(() => coerceRow("match_end", ["abc", "3", "1", "2"], 4)).toThrow(/line 4/);
  });

  it("rejects missing required columns and too many columns", () => {
    expect(() => coerceRow("match_end", ["958.15", "3"], 4)).toThrow(ParseError);
    expect(() => coerceRow("match_end", ["958.15", "3", "1", "2", "extra"], 4)).toThrow(ParseError);
  });

  it("recognises event types", () => {
    expect(isEventType("kill")).toBe(true);
    expect(isEventType("****")).toBe(false);
  });
});
