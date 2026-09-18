import { describe, expect, it } from "vitest";
import { sanitizeLine } from "@/lib/parser/sanitize";

const raw = (eventType: string, fields: string[]) => ({ lineNumber: 1, eventType, fields });

describe("sanitizeLine", () => {
  it("renames **** to kill", () => {
    expect(sanitizeLine(raw("****", ["1", "Team 1"]))?.eventType).toBe("kill");
  });

  it("replaces censored fields with 0", () => {
    const out = sanitizeLine(raw("player_stat", ["1", "1", "Team 1", "****", "Ana", "****5.98"]));
    expect(out?.fields).toEqual(["1", "1", "Team 1", "0", "Ana", "0"]);
  });

  it("drops mercy_rez lines with an empty field", () => {
    expect(sanitizeLine(raw("mercy_rez", ["1", "Team 1", "", "Mercy", "Team 1", "b", "Ana"]))).toBeNull();
    expect(sanitizeLine(raw("mercy_rez", ["1", "Team 1", "a", "Mercy", "Team 1", "b", "Ana"]))).not.toBeNull();
  });

  it("copies the victim into the attacker for All Teams kills", () => {
    const out = sanitizeLine(raw("kill", ["5", "All Teams", "0", "0", "Team 2", "bob", "Tracer", "Environment", "0", "0", "True"]));
    expect(out?.fields.slice(1, 7)).toEqual(["Team 2", "bob", "Tracer", "Team 2", "bob", "Tracer"]);
  });

  it("does not mutate its input", () => {
    const input = raw("****", ["a*"]);
    sanitizeLine(input);
    expect(input).toEqual(raw("****", ["a*"]));
  });
});
