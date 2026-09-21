import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { pairUltimates, ultTimings, type UltLike } from "@/lib/stats/ultimates";
import { parseLog } from "@/lib/parser/parse";

const ult = (matchTime: number, playerName = "a", playerTeam = "Team 1", playerHero: string | null = "Baptiste"): UltLike => ({ matchTime, playerTeam, playerName, playerHero });

describe("pairUltimates", () => {
  it("still drops a false cast and keeps an unpaired start", () => {
    const pairs = pairUltimates([ult(131.24), ult(131.64), ult(200, "b")], [ult(131.55), ult(142.38)]);
    expect(pairs.map((p) => [p.start.matchTime, p.end?.matchTime ?? null])).toEqual([[131.64, 142.38], [200, null]]);
  });
});

describe("ultTimings", () => {
  it("takes the first charged event after the previous cast, ignoring flicker", () => {
    const charged = [ult(10), ult(11), ult(12), ult(30), ult(31)];
    const starts = [ult(20), ult(40)];
    const ends = [ult(25), ult(45)];
    expect(ultTimings(charged, starts, ends)).toEqual([
      { start: ult(20), end: ult(25), chargedAt: 10, chargeSeconds: 10, holdSeconds: 10 },
      { start: ult(40), end: ult(45), chargedAt: 30, chargeSeconds: 10, holdSeconds: 10 },
    ]);
  });

  it("excludes a charged event at exactly the previous cast time and nulls a start with no charge", () => {
    expect(ultTimings([ult(20)], [ult(20), ult(40)], [])).toEqual([
      { start: ult(20), end: null, chargedAt: 20, chargeSeconds: 20, holdSeconds: 0 },
      { start: ult(40), end: null, chargedAt: null, chargeSeconds: null, holdSeconds: null },
    ]);
  });

  it("keeps players apart and ignores a charge with no cast", () => {
    const timings = ultTimings([ult(5, "a"), ult(6, "b"), ult(50, "b")], [ult(9, "b"), ult(10, "a")], []);
    expect(timings.map((t) => [t.start.playerName, t.chargedAt])).toEqual([["b", 6], ["a", 5]]);
  });

  it("returns nothing for no starts", () => {
    expect(ultTimings([ult(1)], [], [])).toEqual([]);
  });

  it("matches Baptiste in the Aatlis sample", () => {
    const ev = parseLog(readFileSync("test/samples/Log-2026-09-18-13-52-18.txt", "utf8")).events;
    const rows = (type: "ultimate_charged" | "ultimate_start" | "ultimate_end") => (ev[type] ?? []) as unknown as UltLike[];
    const bap = ultTimings(rows("ultimate_charged"), rows("ultimate_start"), rows("ultimate_end")).filter((t) => t.start.playerName === "Baptiste");
    expect(bap.map((t) => [t.start.matchTime, t.chargedAt, Number(t.holdSeconds?.toFixed(2))])).toEqual([[201.01, 162.78, 38.23], [623.91, 407.25, 216.66]]);
    expect(bap[1].chargeSeconds).toBeCloseTo(206.24, 2);
  });
});
