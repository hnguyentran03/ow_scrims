import { describe, expect, it } from "vitest";
import { RAMP_CLASS, RAMP_TEXT, rampStep } from "@/lib/ramp";

describe("rampStep", () => {
  it("maps a share onto five steps, rounding to the nearest quarter", () => {
    expect(rampStep(null)).toBe(0);
    expect(rampStep(0)).toBe(0);
    expect(rampStep(0.12)).toBe(0);
    expect(rampStep(0.13)).toBe(1);
    expect(rampStep(0.5)).toBe(2);
    expect(rampStep(0.9)).toBe(4);
    expect(rampStep(1)).toBe(4);
  });
  it("clamps out-of-range shares", () => {
    expect(rampStep(-1)).toBe(0);
    expect(rampStep(2)).toBe(4);
  });
  it("names one background class per step", () => {
    expect(Object.values(RAMP_CLASS)).toEqual(["bg-ramp-0", "bg-ramp-1", "bg-ramp-2", "bg-ramp-3", "bg-ramp-4"]);
  });
  it("uses ground text only on the deepest step, ink otherwise", () => {
    expect(RAMP_TEXT[0]).toBe("text-ink");
    expect(RAMP_TEXT[4]).toBe("text-ground");
  });
});
