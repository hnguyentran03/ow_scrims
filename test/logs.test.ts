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
    const rel = await writeRawLog(42, Buffer.from("hello"));
    expect(rel).toBe(path.relative(process.cwd(), path.join(dir, "42.txt")));
    expect(readFileSync(path.join(dir, "42.txt"), "utf8")).toBe("hello");
    await deleteRawLog(rel);
    expect(existsSync(path.join(dir, "42.txt"))).toBe(false);
    await expect(deleteRawLog(rel)).resolves.toBeUndefined();
    await expect(deleteRawLog(null)).resolves.toBeUndefined();
  });
});
