import { describe, expect, it } from "vitest";
import { MAX_BANS, parseBanInput } from "@/lib/bans";

describe("parseBanInput", () => {
  it("accepts known heroes, dropping duplicates", () => {
    expect(parseBanInput({ scrimId: 1, mapId: 2, side: 2, heroes: ["Ana", "Sombra", "Ana"] })).toEqual({ scrimId: 1, mapId: 2, side: 2, heroes: ["Ana", "Sombra"] });
    expect(parseBanInput({ scrimId: 1, mapId: 2, side: 1, heroes: [] }).heroes).toEqual([]);
  });

  it("rejects bad ids, sides, unknown heroes, and too many bans", () => {
    expect(() => parseBanInput({ scrimId: 0, mapId: 2, side: 1, heroes: [] })).toThrow(/id/);
    expect(() => parseBanInput({ scrimId: 1, mapId: 1.5, side: 1, heroes: [] })).toThrow(/id/);
    expect(() => parseBanInput({ scrimId: 1, mapId: 2, side: 3, heroes: [] })).toThrow(/side/);
    expect(() => parseBanInput({ scrimId: 1, mapId: 2, side: 1, heroes: ["Bob"] })).toThrow(/hero/);
    expect(() => parseBanInput({ scrimId: 1, mapId: 2, side: 1, heroes: "Ana" })).toThrow(/bans/);
    expect(() => parseBanInput({ scrimId: 1, mapId: 2, side: 1, heroes: Array(MAX_BANS + 1).fill("Ana") })).toThrow(/bans/);
  });
});
