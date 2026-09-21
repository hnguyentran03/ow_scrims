import { describe, expect, it } from "vitest";
import { orderUploads } from "@/lib/upload-order";

const f = (name: string, lastModified = 0) => ({ name, lastModified });

describe("orderUploads", () => {
  it("sorts by the timestamp in the Workshop filename", () => {
    const files = [f("Log-2026-09-18-14-30-00.txt", 5), f("Log-2026-09-18-13-52-18.txt", 9), f("Log-2026-09-17-23-59-59.log", 1)];
    expect(orderUploads(files).map((x) => x.name)).toEqual(["Log-2026-09-17-23-59-59.log", "Log-2026-09-18-13-52-18.txt", "Log-2026-09-18-14-30-00.txt"]);
  });

  it("falls back to modification time then name for other filenames", () => {
    const files = [f("b.txt", 200), f("a.txt", 200), f("z.txt", 100), f("Log-2026-01-01-00-00-00.txt", 999)];
    expect(orderUploads(files).map((x) => x.name)).toEqual(["z.txt", "a.txt", "b.txt", "Log-2026-01-01-00-00-00.txt"]);
  });
});
