import { describe, expect, it } from "vitest";
import { RateWindow } from "@/lib/db/rate-window";

describe("RateWindow", () => {
  it("allows up to the limit inside one window and refuses the next", () => {
    const w = new RateWindow(3, 60_000, () => 0);
    expect([w.tryTake(), w.tryTake(), w.tryTake()]).toEqual([true, true, true]);
    expect(w.tryTake()).toBe(false);
    expect(w.size).toBe(3);
  });

  it("refuses a take that is over the limit without recording it", () => {
    let t = 0;
    const w = new RateWindow(1, 60_000, () => t);
    expect(w.tryTake()).toBe(true);
    t = 10_000;
    expect(w.tryTake()).toBe(false);
    expect(w.size).toBe(1); // the refused take is not held against the next window
  });

  it("frees a slot once its timestamp falls out of the window", () => {
    let t = 0;
    const w = new RateWindow(2, 60_000, () => t);
    expect(w.tryTake()).toBe(true);
    t = 30_000;
    expect(w.tryTake()).toBe(true);
    expect(w.tryTake()).toBe(false);
    t = 60_000; // the take at 0 is now exactly a window old
    expect(w.tryTake()).toBe(true);
    expect(w.size).toBe(2);
    t = 120_000;
    expect([w.tryTake(), w.tryTake()]).toEqual([true, true]);
  });

  it("slides rather than resetting on a fixed boundary", () => {
    let t = 0;
    const w = new RateWindow(2, 100, () => t);
    for (const at of [0, 50]) {
      t = at;
      expect(w.tryTake()).toBe(true);
    }
    t = 100;
    expect(w.tryTake()).toBe(true); // the take at 0 expired, the one at 50 has not
    expect(w.tryTake()).toBe(false);
    expect(w.size).toBe(2);
  });
});
