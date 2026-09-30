import { describe, expect, it } from "vitest";
import { recordTone, resultTone } from "@/lib/result";

describe("resultTone", () => {
  it("maps a map result label to a badge tone", () => {
    expect(resultTone("Won")).toBe("won");
    expect(resultTone("Lost")).toBe("lost");
    expect(resultTone("N/A")).toBe("neutral");
  });
});

describe("recordTone", () => {
  it("maps a win/loss record to a badge tone", () => {
    expect(recordTone(3, 1)).toBe("won");
    expect(recordTone(1, 3)).toBe("lost");
    expect(recordTone(2, 2)).toBe("neutral");
  });
});
