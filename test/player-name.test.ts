import { describe, expect, it } from "vitest";
import { nameCandidates } from "@/lib/player-name";

describe("nameCandidates", () => {
  it("tries the decoded form first, then the raw segment", () => {
    expect(nameCandidates("4head%20Dog")).toEqual(["4head Dog", "4head%20Dog"]);
    expect(nameCandidates("sun")).toEqual(["sun"]);
  });

  it("falls back to the raw segment alone when it cannot be decoded", () => {
    expect(nameCandidates("100%")).toEqual(["100%"]);
  });
});
