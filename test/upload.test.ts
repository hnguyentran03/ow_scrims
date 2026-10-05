import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim } from "@/lib/db/queries";
import { maps } from "@/lib/db/schema";
import { capWarnings, chooseSide, handleUpload, maxUploadBytes, parseUpload, UploadError } from "@/lib/upload";

const sampleText = (name: string) => readFileSync(`test/samples/${name}.txt`, "utf8");
const asFile = (name: string, text: string) => new File([text], name, { type: "text/plain" });
const upload = (db: Db, scrimId: number, name: string, text: string, ourSide: 1 | 2 | "auto" = 1) =>
  parseUpload(asFile(name, text)).then((u) => handleUpload(db, { scrimId, upload: u, ourSide }));

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
afterEach(() => vi.unstubAllEnvs());

describe("handleUpload", () => {
  it("parses, inserts, writes the raw log, and records its path", async () => {
    const text = sampleText("Log-2026-04-15-21-12-58");
    const result = await upload(db, scrimId, "Log-2026-04-15-21-12-58.txt", text, 2);
    expect(result.warnings).toEqual([]);
    const [map] = await db.select().from(maps).where(eq(maps.id, result.mapId));
    expect(path.resolve(process.cwd(), map.rawLogPath!)).toBe(path.join(dir, `${result.mapId}.txt`));
    expect(map.originalFilename).toBe("Log-2026-04-15-21-12-58.txt");
    expect(readFileSync(path.join(dir, `${result.mapId}.txt`), "utf8")).toBe(text);
  });

  it("rejects a duplicate with 400", async () => {
    const text = sampleText("Log-2026-04-15-21-12-58");
    await expect(upload(db, scrimId, "again.txt", text)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/already uploaded/) });
  });

  it("rejects wrong extensions, unknown scrims, and stub files without writing anything", async () => {
    const text = sampleText("Log-2024-01-10-20-38-42");
    await expect(parseUpload(asFile("log.csv", text))).rejects.toBeInstanceOf(UploadError);
    await expect(upload(db, 999_999, "log.txt", text)).rejects.toMatchObject({ status: 404 });
    await expect(parseUpload(asFile("stub.txt", text.slice(0, 300)))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/1KB/) });
    const [{ n }] = await db.select({ n: count() }).from(maps).where(eq(maps.scrimId, scrimId));
    expect(n).toBe(1);
    expect(existsSync(path.join(dir, "2.txt"))).toBe(false);
  });

  it("reports parse errors with the line number", async () => {
    const text = sampleText("Log-2024-01-10-20-38-42").replace(",match_end,508.88,2,0,3", ",match_end,508.88,two,0,3");
    await expect(parseUpload(asFile("bad.log", text))).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/line \d+/) });
  });

  it("detects our side from the roster of earlier uploads", async () => {
    const other = await createScrim(db, { name: "vs Y", date: "2026-09-18", opponentName: "Y" });
    const result = await upload(db, other, "Log-2026-04-15-21-12-58.txt", sampleText("Log-2026-04-15-21-12-58"), "auto");
    const [map] = await db.select().from(maps).where(eq(maps.id, result.mapId));
    expect(map.ourSide).toBe(2);
    expect(result.mapName).toBe("Antarctic Peninsula");
  });

  it("asks for the side with 422 when no roster matches, inserting nothing", async () => {
    const [{ n: before }] = await db.select({ n: count() }).from(maps);
    await expect(upload(db, scrimId, "Log-2026-09-18-13-52-18.txt", sampleText("Log-2026-09-18-13-52-18"), "auto")).rejects.toMatchObject({
      status: 422,
      details: { needsSide: true, team1Name: "Team 1", team2Name: "Team 2", team1: expect.arrayContaining(["Baptiste", "Ana"]), team2: expect.arrayContaining(["Moira", "Genji"]) },
    });
    const [{ n: after }] = await db.select({ n: count() }).from(maps);
    expect(after).toBe(before);
  });
});

describe("maxUploadBytes", () => {
  it("defaults to 50 MB and follows MAX_UPLOAD_MB", () => {
    expect(maxUploadBytes()).toBe(50 * 1024 * 1024);
    vi.stubEnv("MAX_UPLOAD_MB", "8");
    expect(maxUploadBytes()).toBe(8 * 1024 * 1024);
    vi.stubEnv("MAX_UPLOAD_MB", "junk");
    expect(maxUploadBytes()).toBe(50 * 1024 * 1024);
  });

  it("refuses a 2 MB file under MAX_UPLOAD_MB=1, naming the configured cap", async () => {
    vi.stubEnv("MAX_UPLOAD_MB", "1");
    const big = asFile("big.txt", "x".repeat(2 * 1024 * 1024));
    await expect(parseUpload(big)).rejects.toMatchObject({ status: 400, message: "file is larger than 1 MB" });
  });
});

describe("capWarnings", () => {
  it("keeps a short list as is and trims a long one with a count of the rest", () => {
    expect(capWarnings([])).toEqual([]);
    const hundred = Array.from({ length: 100 }, (_, i) => `w${i}`);
    expect(capWarnings(hundred)).toEqual(hundred);
    const many = Array.from({ length: 250 }, (_, i) => `w${i}`);
    const capped = capWarnings(many);
    expect(capped).toHaveLength(101);
    expect(capped.slice(0, 100)).toEqual(hundred);
    expect(capped[100]).toBe("… and 150 more");
  });
});

describe("chooseSide", () => {
  const rosters = { team1Name: "Team 1", team2Name: "Team 2", team1: ["a", "b", "c", "d", "e"], team2: ["v", "w", "x", "y", "z"] };
  it("picks the side sharing at least three names when the other shares at most one", () => {
    expect(chooseSide(rosters, new Set(["a", "b", "c"]))).toBe(1);
    expect(chooseSide(rosters, new Set(["x", "y", "z", "a"]))).toBe(2);
  });
  it("is undecided on two matches, on three-and-two, and on an empty roster", () => {
    expect(chooseSide(rosters, new Set(["a", "b"]))).toBeNull();
    expect(chooseSide(rosters, new Set(["a", "b", "c", "x", "y"]))).toBeNull();
    expect(chooseSide(rosters, new Set())).toBeNull();
  });
  it("never counts the censored name", () => {
    expect(chooseSide({ ...rosters, team1: ["0", "0", "0", "a"] }, new Set(["0", "a"]))).toBeNull();
  });
});
