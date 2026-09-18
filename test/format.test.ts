import { describe, expect, it } from "vitest";
import { formatDuration, formatInt, resultLabel } from "@/lib/format";

describe("format", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatDuration(661.03)).toBe("11:01");
    expect(formatDuration(59.9)).toBe("00:59");
  });
  it("formats integers with thousands separators", () => {
    expect(formatInt(14991.42)).toBe("14,991");
  });
  it("labels results from our perspective", () => {
    expect(resultLabel({ ourSide: 1, winnerSide: 1 })).toBe("Won");
    expect(resultLabel({ ourSide: 2, winnerSide: 1 })).toBe("Lost");
    expect(resultLabel({ ourSide: 2, winnerSide: null })).toBe("N/A");
  });
});
