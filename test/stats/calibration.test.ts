import { describe, expect, it } from "vitest";
import { applyAffine, fitBounds, invertAffine, parseCalibration, solveAffine, PLANE_SIZE, type Affine, type Pair } from "@/lib/stats/calibration";

const near = (got: { px: number; py: number }, px: number, py: number) => {
  expect(got.px).toBeCloseTo(px, 6);
  expect(got.py).toBeCloseTo(py, 6);
};

describe("applyAffine and invertAffine", () => {
  const m: Affine = { a: 2, b: 0.5, c: 10, d: -1, e: 3, f: -4 };
  it("applies the six coefficients and inverts them", () => {
    near(applyAffine(m, { x: 1, z: 2 }), 13, 1);
    const inv = invertAffine(m)!;
    const back = applyAffine(inv, { x: 13, z: 1 });
    expect(back.px).toBeCloseTo(1, 9);
    expect(back.py).toBeCloseTo(2, 9);
  });

  it("returns null for a singular transform", () => {
    expect(invertAffine({ a: 1, b: 2, c: 0, d: 2, e: 4, f: 0 })).toBeNull();
  });
});

describe("fitBounds", () => {
  it("maps the padded bounding box onto the plane with z upwards and aspect preserved", () => {
    expect(PLANE_SIZE).toBe(1000);
    const m = fitBounds([{ x: 0, z: 0 }, { x: 100, z: 50 }]);
    // span 100, padded 120, scale 1000/120; centre (50, 25) lands at (500, 500)
    near(applyAffine(m, { x: 50, z: 25 }), 500, 500);
    const lo = applyAffine(m, { x: 0, z: 0 });
    const hi = applyAffine(m, { x: 100, z: 50 });
    expect(lo.px).toBeCloseTo(500 - 50 * (1000 / 120), 6);
    expect(hi.px).toBeCloseTo(500 + 50 * (1000 / 120), 6);
    expect(lo.py).toBeGreaterThan(hi.py);
    for (const p of [lo, hi]) {
      expect(p.px).toBeGreaterThanOrEqual(0);
      expect(p.px).toBeLessThanOrEqual(PLANE_SIZE);
      expect(p.py).toBeGreaterThanOrEqual(0);
      expect(p.py).toBeLessThanOrEqual(PLANE_SIZE);
    }
  });

  it("centres a single point and an empty set", () => {
    near(applyAffine(fitBounds([{ x: 7, z: -3 }]), { x: 7, z: -3 }), 500, 500);
    near(applyAffine(fitBounds([]), { x: 0, z: 0 }), 500, 500);
  });
});

describe("solveAffine", () => {
  const truth: Affine = { a: 3, b: -1, c: 200, d: 0.5, e: -3, f: 900 };
  const pair = (x: number, z: number, noise = 0): Pair => {
    const { px, py } = applyAffine(truth, { x, z });
    return { world: { x, z }, image: { px: px + noise, py: py - noise } };
  };
  const close = (got: Affine | null, want: Affine, digits: number) => {
    expect(got).not.toBeNull();
    for (const k of ["a", "b", "c", "d", "e", "f"] as const) expect(got![k], k).toBeCloseTo(want[k], digits);
  };

  it("recovers a transform exactly from three pairs, including a mirrored one", () => {
    close(solveAffine([pair(0, 0), pair(50, 10), pair(-20, 40)]), truth, 6);
    const mirrored: Affine = { a: -2, b: 0, c: 500, d: 0, e: 2, f: 100 };
    const p = (x: number, z: number): Pair => ({ world: { x, z }, image: applyAffine(mirrored, { x, z }) });
    close(solveAffine([p(1, 1), p(10, 3), p(4, 9)]), mirrored, 6);
  });

  it("fits four noisy pairs in least squares", () => {
    const got = solveAffine([pair(0, 0, 0.5), pair(50, 10, -0.5), pair(-20, 40, 0.5), pair(30, -30, -0.5)])!;
    expect(got).not.toBeNull();
    for (const k of ["a", "b", "d", "e"] as const) expect(Math.abs(got[k] - truth[k]), k).toBeLessThan(0.05);
    for (const k of ["c", "f"] as const) expect(Math.abs(got[k] - truth[k]), k).toBeLessThan(2);
  });

  it("returns null with fewer than three pairs or collinear world points", () => {
    expect(solveAffine([pair(0, 0), pair(1, 1)])).toBeNull();
    expect(solveAffine([pair(0, 0), pair(1, 1), pair(2, 2), pair(3, 3)])).toBeNull();
  });
});

describe("parseCalibration", () => {
  const identity: Affine = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
  const pair = { world: { x: 1, z: 2 }, image: { px: 3, py: 4 } };

  it("parses valid JSON with an objective", () => {
    const raw = JSON.stringify({ pairs: [pair], affine: identity, objective: { x: 1.5, z: -2 } });
    expect(parseCalibration(raw)).toEqual({ pairs: [pair], affine: identity, objective: { x: 1.5, z: -2 } });
  });

  it("parses valid JSON with a null objective", () => {
    const raw = JSON.stringify({ pairs: [pair], affine: identity, objective: null });
    expect(parseCalibration(raw)).toEqual({ pairs: [pair], affine: identity, objective: null });
  });

  it("returns null when pairs is missing", () => {
    expect(parseCalibration(JSON.stringify({ affine: identity }))).toBeNull();
  });

  it("returns null when the affine has a non-finite value", () => {
    const raw = JSON.stringify({ pairs: [pair], affine: { ...identity, a: "1" } });
    expect(parseCalibration(raw)).toBeNull();
  });

  it("keeps the calibration but nulls out a non-numeric objective", () => {
    const raw = JSON.stringify({ pairs: [pair], affine: identity, objective: { x: "1", z: 2 } });
    expect(parseCalibration(raw)).toEqual({ pairs: [pair], affine: identity, objective: null });
  });

  it("keeps the calibration but nulls out a non-finite objective", () => {
    const raw = JSON.stringify({ pairs: [pair], affine: identity, objective: { x: NaN, z: 0 } });
    expect(parseCalibration(raw)).toEqual({ pairs: [pair], affine: identity, objective: null });
  });

  it("returns null for unparsable JSON", () => {
    expect(parseCalibration("not json")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseCalibration(null)).toBeNull();
  });
});
