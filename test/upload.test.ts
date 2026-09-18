import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim } from "@/lib/db/queries";
import { maps } from "@/lib/db/schema";
import { handleUpload, UploadError } from "@/lib/upload";

const sampleText = (name: string) => readFileSync(`test/samples/${name}.txt`, "utf8");
const asFile = (name: string, text: string) => new File([text], name, { type: "text/plain" });

let dir: string;
let db: Db;
let scrimId: number;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ow-upload-"));
  process.env.LOG_DIR = dir;
  db = await createTestDb();
  scrimId = await createScrim(db, { name: "vs X", date: "2026-09-17", opponentName: "X" });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("handleUpload", () => {
  it("parses, inserts, writes the raw log, and records its path", async () => {
    const text = sampleText("Log-2026-04-15-21-12-58");
    const result = await handleUpload(db, { scrimId, file: asFile("Log-2026-04-15-21-12-58.txt", text), ourSide: 2 });
    expect(result.warnings).toEqual([]);
    const [map] = await db.select().from(maps).where(eq(maps.id, result.mapId));
    expect(map.rawLogPath).toBe(path.relative(process.cwd(), path.join(dir, `${result.mapId}.txt`)));
    expect(map.originalFilename).toBe("Log-2026-04-15-21-12-58.txt");
    expect(readFileSync(path.join(dir, `${result.mapId}.txt`), "utf8")).toBe(text);
  });

  it("rejects a duplicate with 400", async () => {
    const text = sampleText("Log-2026-04-15-21-12-58");
    await expect(handleUpload(db, { scrimId, file: asFile("again.txt", text), ourSide: 1 })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/already uploaded/) });
  });

  it("rejects wrong extensions, unknown scrims, and stub files without writing anything", async () => {
    const text = sampleText("Log-2024-01-10-20-38-42");
    await expect(handleUpload(db, { scrimId, file: asFile("log.csv", text), ourSide: 1 })).rejects.toBeInstanceOf(UploadError);
    await expect(handleUpload(db, { scrimId: 999_999, file: asFile("log.txt", text), ourSide: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(handleUpload(db, { scrimId, file: asFile("stub.txt", text.slice(0, 300)), ourSide: 1 })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/1KB/) });
    const [{ n }] = await db.select({ n: count() }).from(maps).where(eq(maps.scrimId, scrimId));
    expect(n).toBe(1);
    expect(existsSync(path.join(dir, "2.txt"))).toBe(false);
  });

  it("reports parse errors with the line number", async () => {
    const text = sampleText("Log-2024-01-10-20-38-42").replace(",match_end,508.88,2,0,3", ",match_end,508.88,two,0,3");
    await expect(handleUpload(db, { scrimId, file: asFile("bad.log", text), ourSide: 1 })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/line \d+/) });
  });
});
