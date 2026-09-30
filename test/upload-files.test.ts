import { describe, expect, it } from "vitest";
import { pickLogFiles } from "@/lib/upload-files";

const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

describe("pickLogFiles", () => {
  it("keeps .txt and .log files and drops empty entries", () => {
    const r = pickLogFiles([file("a.txt"), file("b.LOG"), file("empty.txt", 0), "not-a-file"]);
    expect(r.error).toBeNull();
    expect(r.files.map((f) => f.name)).toEqual(["a.txt", "b.LOG"]);
  });
  it("rejects a wrong extension or nothing at all", () => {
    expect(pickLogFiles([file("a.csv")]).error).toBe("Choose one or more .txt or .log Workshop logs.");
    expect(pickLogFiles([]).error).toBe("Choose one or more .txt or .log Workshop logs.");
  });
});
