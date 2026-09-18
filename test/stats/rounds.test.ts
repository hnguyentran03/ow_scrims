import { describe, expect, it } from "vitest";
import { dedupeRounds, roundCapturer } from "@/lib/stats/rounds";

const map = { team1Name: "Team 1", team2Name: "Team 2" };
const round = (roundNumber: number, matchTime: number, team1Score: number, team2Score: number, capturingTeam = "0") => ({
  roundNumber, matchTime, team1Score, team2Score, capturingTeam,
});

describe("dedupeRounds", () => {
  it("keeps the first row per round number, sorted by time", () => {
    const rows = dedupeRounds([round(3, 958.15, 1, 2), round(1, 309, 0, 1), round(3, 958.15, 1, 2), round(2, 647, 1, 1)]);
    expect(rows.map((r) => r.roundNumber)).toEqual([1, 2, 3]);
  });

  it("returns an empty list for no rows", () => {
    expect(dedupeRounds([])).toEqual([]);
  });
});

describe("roundCapturer", () => {
  it("uses the logged team when it names a team", () => {
    expect(roundCapturer(round(1, 100, 0, 0, "Team 2"), undefined, map)).toBe("Team 2");
  });

  it("derives the capturer from the score that rose", () => {
    expect(roundCapturer(round(1, 309, 0, 1), undefined, map)).toBe("Team 2");
    expect(roundCapturer(round(2, 647, 1, 1), round(1, 309, 0, 1), map)).toBe("Team 1");
  });

  it("returns null when no score rose or both rose", () => {
    expect(roundCapturer(round(1, 100, 0, 0), undefined, map)).toBeNull();
    expect(roundCapturer(round(2, 200, 1, 1), round(1, 100, 0, 0), map)).toBeNull();
    expect(roundCapturer(round(1, 100, 0, 0, "All Teams"), undefined, map)).toBeNull();
  });
});
