import { describe, expect, it } from "vitest";
import { linearFit, MIN_FIT_POINTS } from "@/lib/stats/regression";

const pts = (...xy: [number, number][]) => xy.map(([x, y]) => ({ x, y }));

describe("linearFit", () => {
  it("recovers an exact line", () => {
    expect(linearFit(pts([0, 1], [1, 3], [2, 5]))).toEqual({ slope: 2, intercept: 1, r: 1, n: 3 });
  });

  it("needs MIN_FIT_POINTS points with differing x", () => {
    expect(MIN_FIT_POINTS).toBe(3);
    expect(linearFit(pts([0, 1], [1, 3]))).toBeNull();
    expect(linearFit(pts([2, 1], [2, 3], [2, 5]))).toBeNull();
  });

  it("gives a flat line r of 0 when every y is equal", () => {
    expect(linearFit(pts([0, 4], [1, 4], [2, 4]))).toEqual({ slope: 0, intercept: 4, r: 0, n: 3 });
  });

  it("fits a noisy set with r strictly between 0 and 1", () => {
    const f = linearFit(pts([1, 2], [2, 4], [3, 5], [4, 4], [5, 5]))!;
    expect(f.slope).toBeCloseTo(0.6, 6);
    expect(f.intercept).toBeCloseTo(2.2, 6);
    expect(f.r).toBeGreaterThan(0.7);
    expect(f.r).toBeLessThan(1);
  });
});
