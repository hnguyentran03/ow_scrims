import { describe, expect, it } from "vitest";
import { MAX_PAIRS, parseCalibrationInput } from "@/lib/calibration-input";

const pair = (x: number) => ({ world: { x, z: x * 2 }, image: { px: x * 10, py: 5 } });
const good = { id: 3, pairs: [pair(0), pair(1), pair(2)], width: 800, height: 600, objective: { px: 1, py: 2 } };

describe("parseCalibrationInput", () => {
  it("accepts a well-formed payload and normalises a missing objective to null", () => {
    expect(parseCalibrationInput(good)).toEqual(good);
    expect(parseCalibrationInput({ ...good, objective: undefined })?.objective).toBeNull();
  });

  it("rejects bad ids, sizes, pair counts, and non-finite numbers", () => {
    expect(parseCalibrationInput({ ...good, id: 0 })).toBeNull();
    expect(parseCalibrationInput({ ...good, id: 1.5 })).toBeNull();
    expect(parseCalibrationInput({ ...good, width: 0 })).toBeNull();
    expect(parseCalibrationInput({ ...good, height: 16385 })).toBeNull();
    expect(parseCalibrationInput({ ...good, height: 100.5 })).toBeNull();
    expect(parseCalibrationInput({ ...good, pairs: good.pairs.slice(0, 2) })).toBeNull();
    expect(parseCalibrationInput({ ...good, pairs: Array.from({ length: MAX_PAIRS + 1 }, (_, i) => pair(i)) })).toBeNull();
    expect(parseCalibrationInput({ ...good, pairs: [pair(0), pair(1), { world: { x: Infinity, z: 0 }, image: { px: 0, py: 0 } }] })).toBeNull();
    expect(parseCalibrationInput({ ...good, objective: { px: "1", py: 2 } })).toBeNull();
    expect(parseCalibrationInput(null)).toBeNull();
    expect(parseCalibrationInput("x")).toBeNull();
  });
});
