import { describe, expect, it } from "vitest";
import { groundPoint, parsePosition } from "@/lib/stats/positions";

describe("parsePosition", () => {
  it("parses the Workshop tuple with negatives, decimals, and spaces", () => {
    expect(parsePosition("(-51.67, 270.23, 333.79)")).toEqual({ x: -51.67, y: 270.23, z: 333.79 });
    expect(parsePosition("(1,2,3)")).toEqual({ x: 1, y: 2, z: 3 });
    expect(parsePosition("( 0.5 , -0.25 , 7 )")).toEqual({ x: 0.5, y: -0.25, z: 7 });
  });

  it("returns null for the broken ultimate_start value, a censored field, and null", () => {
    expect(parsePosition("2}")).toBeNull();
    expect(parsePosition("0")).toBeNull();
    expect(parsePosition("(1, 2)")).toBeNull();
    expect(parsePosition(null)).toBeNull();
    expect(parsePosition(undefined)).toBeNull();
  });
});

describe("groundPoint", () => {
  it("drops the height", () => {
    expect(groundPoint({ x: 1, y: 270, z: 3 })).toEqual({ x: 1, z: 3 });
  });
});
