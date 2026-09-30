import { describe, expect, it } from "vitest";
import { validateScrimInput } from "@/lib/scrim-input";

describe("validateScrimInput", () => {
  it("trims and accepts a full input", () => {
    const r = validateScrimInput({ name: " vs Cerberus ", date: "2026-04-15", opponentName: "Cerberus" });
    expect(r.errors).toBeNull();
    expect(r.values).toEqual({ name: "vs Cerberus", date: "2026-04-15", opponentName: "Cerberus" });
  });
  it("names each missing or malformed field", () => {
    const r = validateScrimInput({ name: "", date: "15/04/2026", opponentName: null });
    expect(r.errors).toEqual({ name: "Give the scrim a name.", date: "Pick a date.", opponentName: "Name the opponent." });
    expect(r.values).toEqual({ name: "", date: "15/04/2026", opponentName: "" });
  });
});
