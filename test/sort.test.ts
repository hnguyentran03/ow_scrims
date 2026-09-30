import { describe, expect, it } from "vitest";
import { compareBy } from "@/lib/sort";

describe("compareBy", () => {
  const rows = [
    { name: "b", n: 2 },
    { name: "a", n: 10 },
    { name: "c", n: 1 },
  ];
  it("sorts numbers numerically in either direction", () => {
    expect([...rows].sort(compareBy("n", 1)).map((r) => r.n)).toEqual([1, 2, 10]);
    expect([...rows].sort(compareBy("n", -1)).map((r) => r.n)).toEqual([10, 2, 1]);
  });
  it("sorts strings with localeCompare", () => {
    expect([...rows].sort(compareBy("name", 1)).map((r) => r.name)).toEqual(["a", "b", "c"]);
  });
});
