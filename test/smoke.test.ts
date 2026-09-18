import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("samples", () => {
  it("ships the ten sample logs", () => {
    const text = readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8");
    expect(text.split("\n").filter(Boolean)).toHaveLength(310);
  });
});
