import { describe, expect, it } from "vitest";
import { applyAffine, fitBounds, invertAffine, parseCalibration, PLANE_SIZE, type Affine } from "@/lib/stats/calibration";

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

  it("returns null for unparsable JSON", () => {
    expect(parseCalibration("not json")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseCalibration(null)).toBeNull();
  });
});
