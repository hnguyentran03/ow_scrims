import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseLog } from "@/lib/parser/parse";
import { baseMapName, deriveMapMeta, deriveWinner } from "@/lib/parser/derive";

const sample = (name: string) => readFileSync(`test/samples/${name}.txt`, "utf8");

const CASES: Array<[string, string, string, number, number, number, 1 | 2]> = [
  ["Log-2023-12-12-22-15-10", "Busan", "Control", 1, 2, 958.15, 2],
  ["Log-2024-01-10-20-38-42", "Watchpoint: Gibraltar", "Escort", 0, 3, 508.88, 2],
  ["Log-2024-01-22-20-02-45", "Lijiang Tower", "Control", 0, 3, 727.37, 2],
  ["Log-2024-01-22-20-21-43", "Watchpoint: Gibraltar", "Escort", 2, 3, 947.39, 2],
  ["Log-2024-01-22-21-35-38", "Ilios", "Control", 2, 1, 707.48, 1],
  ["Log-2024-02-05-20-07-38", "Lijiang Tower", "Control", 2, 1, 744.01, 1],
  ["Log-2024-05-03-20-06-06", "Lijiang Tower", "Control", 3, 0, 598.41, 1],
  ["Log-2024-06-16-22-24-33", "King's Row", "Hybrid", 2, 3, 938.92, 2],
  ["Log-2026-04-02-17-21-48", "Lijiang Tower", "Control", 1, 2, 744.21, 2],
  ["Log-2026-04-15-21-12-58", "Antarctic Peninsula", "Control", 3, 0, 661.03, 1],
];

describe("deriveMapMeta on real logs", () => {
  it.each(CASES)("%s", (name, mapName, mapType, s1, s2, duration, winner) => {
    const meta = deriveMapMeta(parseLog(sample(name)));
    expect(meta).toMatchObject({ mapName, mapType, team1Score: s1, team2Score: s2, winnerSide: winner });
    expect(meta.durationSeconds).toBeCloseTo(duration, 2);
  });

  it("reads custom team names", () => {
    const meta = deriveMapMeta(parseLog(sample("Log-2024-06-16-22-24-33")));
    expect(meta.team1Name).toBe("4head Dog");
    expect(meta.team2Name).toBe("Cerberus");
    expect(meta.roundCount).toBe(2);
  });
});

describe("deriveWinner rules", () => {
  const base = { team1Name: "A", team2Name: "B", captures: [] as Array<{ capturingTeam: string; matchTimeRemaining: number }> };

  it("Push is always null", () => {
    expect(deriveWinner({ ...base, mapType: "Push", team1Score: 1, team2Score: 0 })).toBeNull();
  });

  it("Flashpoint and Clash compare scores", () => {
    expect(deriveWinner({ ...base, mapType: "Flashpoint", team1Score: 3, team2Score: 2 })).toBe(1);
    expect(deriveWinner({ ...base, mapType: "Clash", team1Score: 4, team2Score: 5 })).toBe(2);
    expect(deriveWinner({ ...base, mapType: "Control", team1Score: 2, team2Score: 2 })).toBeNull();
  });

  it("Escort with equal scores falls back to captures", () => {
    const tie = { ...base, mapType: "Escort" as const, team1Score: 2, team2Score: 2 };
    expect(deriveWinner({ ...tie, captures: [{ capturingTeam: "A", matchTimeRemaining: 100 }, { capturingTeam: "B", matchTimeRemaining: 50 }] })).toBe(1);
    expect(deriveWinner({ ...tie, captures: [{ capturingTeam: "A", matchTimeRemaining: 10 }, { capturingTeam: "B", matchTimeRemaining: 50 }] })).toBe(2);
    expect(deriveWinner({ ...tie, captures: [{ capturingTeam: "A", matchTimeRemaining: 10 }] })).toBe(1);
    expect(deriveWinner({ ...tie, captures: [{ capturingTeam: "B", matchTimeRemaining: 10 }] })).toBe(2);
    expect(deriveWinner({ ...tie, captures: [] })).toBeNull();
  });

  it("Escort with equal scores and unequal capture counts gives it to the team with more captures", () => {
    const tie = { ...base, mapType: "Escort" as const, team1Score: 2, team2Score: 2 };
    expect(deriveWinner({ ...tie, captures: [{ capturingTeam: "A", matchTimeRemaining: 280 }, { capturingTeam: "A", matchTimeRemaining: 200 }, { capturingTeam: "A", matchTimeRemaining: 50 }, { capturingTeam: "B", matchTimeRemaining: 100 }] })).toBe(1);
    expect(deriveWinner({ ...tie, captures: [{ capturingTeam: "A", matchTimeRemaining: 100 }, { capturingTeam: "B", matchTimeRemaining: 280 }, { capturingTeam: "B", matchTimeRemaining: 200 }, { capturingTeam: "B", matchTimeRemaining: 50 }] })).toBe(2);
  });

  it("Hybrid with differing scores uses the score", () => {
    expect(deriveWinner({ ...base, mapType: "Hybrid", team1Score: 0, team2Score: 3 })).toBe(2);
  });
});

describe("baseMapName", () => {
  it("strips a trailing parenthesised variant and keeps everything else", () => {
    expect(baseMapName("Lijiang Tower (Lunar New Year)")).toBe("Lijiang Tower");
    expect(baseMapName("Eichenwalde (Halloween)")).toBe("Eichenwalde");
    expect(baseMapName("King's Row (Winter) ")).toBe("King's Row");
  });

  it("title-cases a name the Workshop wrote in capitals and leaves mixed case alone", () => {
    expect(baseMapName("NEON JUNCTION")).toBe("Neon Junction");
    expect(baseMapName("TEMPLE OF ANUBIS")).toBe("Temple of Anubis");
    expect(baseMapName("New Junk City")).toBe("New Junk City");
    expect(baseMapName("Esperança")).toBe("Esperança");
    expect(baseMapName("Watchpoint: Gibraltar")).toBe("Watchpoint: Gibraltar");
    expect(baseMapName("Lijiang Tower")).toBe("Lijiang Tower");
  });
});
