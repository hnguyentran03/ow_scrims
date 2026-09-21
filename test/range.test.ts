import { describe, expect, it } from "vitest";
import { parseRange, validDate } from "@/lib/range";

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
