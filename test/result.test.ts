import { describe, expect, it } from "vitest";
import { resultTone } from "@/lib/result";

describe("resultTone", () => {
  it("maps a map result label to a badge tone", () => {
    expect(resultTone("Won")).toBe("won");
    expect(resultTone("Lost")).toBe("lost");
    expect(resultTone("N/A")).toBe("neutral");
  });
});
