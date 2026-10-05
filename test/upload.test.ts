import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim } from "@/lib/db/queries";
import { maps } from "@/lib/db/schema";
import { chooseSide, handleUpload, UploadError } from "@/lib/upload";

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
    expect(path.resolve(process.cwd(), map.rawLogPath!)).toBe(path.join(dir, `${result.mapId}.txt`));
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

  it("detects our side from the roster of earlier uploads", async () => {
    const other = await createScrim(db, { name: "vs Y", date: "2026-09-18", opponentName: "Y" });
    const result = await handleUpload(db, { scrimId: other, file: asFile("Log-2026-04-15-21-12-58.txt", sampleText("Log-2026-04-15-21-12-58")), ourSide: "auto" });
    const [map] = await db.select().from(maps).where(eq(maps.id, result.mapId));
    expect(map.ourSide).toBe(2);
    expect(result.mapName).toBe("Antarctic Peninsula");
  });

  it("asks for the side with 422 when no roster matches, inserting nothing", async () => {
    const [{ n: before }] = await db.select({ n: count() }).from(maps);
    await expect(handleUpload(db, { scrimId, file: asFile("Log-2026-09-18-13-52-18.txt", sampleText("Log-2026-09-18-13-52-18")), ourSide: "auto" })).rejects.toMatchObject({
      status: 422,
      details: { needsSide: true, team1Name: "Team 1", team2Name: "Team 2", team1: expect.arrayContaining(["Baptiste", "Ana"]), team2: expect.arrayContaining(["Moira", "Genji"]) },
    });
    const [{ n: after }] = await db.select({ n: count() }).from(maps);
    expect(after).toBe(before);
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
