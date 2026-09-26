import { describe, expect, it } from "vitest";
import { extraParams, parseHero, parseRange, rangeQuery, validDate } from "@/lib/range";

describe("range", () => {
  it("accepts real calendar dates only", () => {
    expect(validDate("2026-09-21")).toBe(true);
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2026-9-1")).toBe(false);
    expect(validDate("2026-09-21T00:00")).toBe(false);
    expect(validDate(["2026-09-21"])).toBe(false);
    expect(validDate(undefined)).toBe(false);
  });

  it("keeps only valid bounds", () => {
    expect(parseRange({ from: "2026-09-01", to: "2026-09-30" })).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(parseRange({ from: "nope", to: "2026-09-30" })).toEqual({ to: "2026-09-30" });
    expect(parseRange({})).toEqual({});
  });
});

describe("parseHero", () => {
  it("keeps a hero from the allowed set and drops anything else", () => {
    expect(parseHero({ hero: "Ana" }, ["Ana", "Kiriko"])).toBe("Ana");
    expect(parseHero({ hero: "Genji" }, ["Ana"])).toBeUndefined();
    expect(parseHero({ hero: ["Ana"] }, ["Ana"])).toBeUndefined();
    expect(parseHero({ hero: "" }, ["Ana"])).toBeUndefined();
    expect(parseHero({}, ["Ana"])).toBeUndefined();
  });
});

describe("extraParams", () => {
  it("returns every pair except the omitted keys, in order", () => {
    expect(extraParams(new URLSearchParams("from=2026-09-01&hero=Ana&to=2026-09-30&x=1"), ["from", "to"])).toEqual([["hero", "Ana"], ["x", "1"]]);
    expect(extraParams(new URLSearchParams(""), ["from"])).toEqual([]);
  });
});

describe("rangeQuery", () => {
  it("builds ?from=&to= plus extras, and is empty when nothing is set", () => {
    expect(rangeQuery({ from: "2026-09-01", to: "2026-09-30" })).toBe("?from=2026-09-01&to=2026-09-30");
    expect(rangeQuery({ to: "2026-09-30" }, { hero: "Ana" })).toBe("?to=2026-09-30&hero=Ana");
    expect(rangeQuery({}, { hero: undefined })).toBe("");
  });
});
