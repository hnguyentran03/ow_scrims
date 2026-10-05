import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ow-logs-"));
  process.env.LOG_DIR = dir;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("raw log storage", () => {
  it("writes to <LOG_DIR>/<mapId>.txt and deletes it again", async () => {
    const { writeRawLog, deleteRawLog } = await import("@/lib/logs");
    const stored = await writeRawLog(42, Buffer.from("hello"));
    // The temp dir is outside the working directory, so the stored path is absolute.
    expect(stored).toBe(path.join(dir, "42.txt"));
    expect(readFileSync(path.join(dir, "42.txt"), "utf8")).toBe("hello");
    await deleteRawLog(stored);
    expect(existsSync(path.join(dir, "42.txt"))).toBe(false);
    await expect(deleteRawLog(stored)).resolves.toBeUndefined();
    await expect(deleteRawLog(null)).resolves.toBeUndefined();
  });

  it("stores a path relative to cwd when the directory is inside it, and honours an explicit directory", async () => {
    const { writeRawLog, deleteRawLog } = await import("@/lib/logs");
    const inside = path.join(process.cwd(), ".test-logs");
    const rel = await writeRawLog(7, Buffer.from("x"), inside);
    expect(rel).toBe(path.join(".test-logs", "7.txt"));
    await deleteRawLog(rel);
    rmSync(inside, { recursive: true, force: true });
    const explicit = path.join(dir, "sub");
    const abs = await writeRawLog(8, Buffer.from("y"), explicit);
    expect(abs).toBe(path.join(explicit, "8.txt"));
    await deleteRawLog(abs);
  });
});
