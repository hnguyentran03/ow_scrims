import { describe, expect, it } from "vitest";
import { splitFields, tokenizeLog } from "@/lib/parser/tokenize";
import { ParseError } from "@/lib/parser/errors";

describe("splitFields", () => {
  it("splits on commas outside parentheses only", () => {
    expect(splitFields("a,b,(1.5, 2, 3),c")).toEqual(["a", "b", "(1.5, 2, 3)", "c"]);
  });
  it("keeps empty fields", () => {
    expect(splitFields("a,,c")).toEqual(["a", "", "c"]);
  });
});

describe("tokenizeLog", () => {
  it("strips the timestamp prefix and empty leading field, keeps line numbers", () => {
    const text = "[00:00:00] ,match_start,0,Busan,Control,Team 1,Team 2\n\n[00:03:07] ,****,28.43,Team 2,x,Bastion,Team 1,y,Orisa,Secondary Fire,93.14,0,0\r\n";
    const lines = tokenizeLog(text);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ lineNumber: 1, eventType: "match_start", fields: ["0", "Busan", "Control", "Team 1", "Team 2"] });
    expect(lines[1].lineNumber).toBe(3);
    expect(lines[1].eventType).toBe("****");
    expect(lines[1].fields).toHaveLength(11);
  });

  it("rejects a line without the timestamp prefix", () => {
    expect(() => tokenizeLog("match_start,0,Busan")).toThrow(ParseError);
  });
});
