import { describe, expect, it } from "vitest";
import { parsePositiveInt } from "@/lib/ids";

describe("parsePositiveInt", () => {
  it("accepts canonical positive integers up to the int4 ceiling", () => {
    expect(parsePositiveInt("1")).toBe(1);
    expect(parsePositiveInt("2147483647")).toBe(2147483647);
  });

  it("rejects everything else", () => {
    for (const raw of ["0", "-1", "007", "1.5", " 5 ", "5e0", "0x5", "abc", "", "2147483648", "9999999999"]) {
      expect(parsePositiveInt(raw), raw).toBeNull();
    }
  });
});
