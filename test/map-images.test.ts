import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim, getMapImage, listStagesSeen, setCalibration } from "@/lib/db/queries";
import { insertParsedMap } from "@/lib/db/insert-map";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";
import { calibratedImages, deleteImageFile, detectImageType, mapImageResponse, MAX_IMAGE_BYTES, uploadMapImageResponse } from "@/lib/map-images";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0)]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...new Array(64).fill(0)]);

function post(fields: Record<string, string>, file?: { name: string; bytes: Uint8Array; type?: string }, contentLength?: number): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append("file", new File([file.bytes as Uint8Array<ArrayBuffer>], file.name, { type: file.type ?? "application/octet-stream" }));
  const headers: Record<string, string> = {};
  if (contentLength !== undefined) headers["content-length"] = String(contentLength);
  return new Request("http://localhost/api/map-images", { method: "POST", body: form, headers });
}

describe("detectImageType", () => {
  it("requires the extension and the magic bytes to agree", () => {
    expect(detectImageType(PNG, "map.png")).toEqual({ ext: "png", contentType: "image/png" });
    expect(detectImageType(JPEG, "MAP.JPEG")).toEqual({ ext: "jpg", contentType: "image/jpeg" });
    expect(detectImageType(WEBP, "map.webp")).toEqual({ ext: "webp", contentType: "image/webp" });
    expect(detectImageType(JPEG, "map.png")).toBeNull();
    expect(detectImageType(PNG, "map.gif")).toBeNull();
    expect(detectImageType(PNG, "map")).toBeNull();
    expect(detectImageType(new Uint8Array(2), "map.png")).toBeNull();
  });
});

describe("upload and serve", () => {
  let db: Db;
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "map-images-"));
    process.env.MAP_IMAGE_DIR = dir;
    db = await createTestDb();
    const scrimId = await createScrim(db, { name: "vs X", date: "2026-09-10", opponentName: "X" });
    const parsed = parseLog(readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8"));
    await insertParsedMap(db, { scrimId, ourSide: 1, parsed, meta: deriveMapMeta(parsed), originalFilename: "a.txt" });
  });

  afterAll(async () => {
    delete process.env.MAP_IMAGE_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects requests in the documented order", async () => {
    expect((await uploadMapImageResponse(db, post({ mapName: "Antarctic Peninsula", stage: "0" }, { name: "a.png", bytes: PNG }))).status).toBe(411);
    expect((await uploadMapImageResponse(db, post({ mapName: "Antarctic Peninsula", stage: "0" }, { name: "a.png", bytes: PNG }, MAX_IMAGE_BYTES + 1))).status).toBe(413);
    expect((await uploadMapImageResponse(db, post({ mapName: "Antarctic Peninsula", stage: "x" }, { name: "a.png", bytes: PNG }, 500))).status).toBe(400);
    expect((await uploadMapImageResponse(db, post({ mapName: "Antarctic Peninsula", stage: "0" }, undefined, 500))).status).toBe(400);
    expect((await uploadMapImageResponse(db, post({ mapName: "Nowhere", stage: "0" }, { name: "a.png", bytes: PNG }, 500))).status).toBe(404);
    expect((await uploadMapImageResponse(db, post({ mapName: "Antarctic Peninsula", stage: "0" }, { name: "a.png", bytes: JPEG }, 500))).status).toBe(415);
  });

  it("stores an accepted image under its id, serves it, replaces it, and deletes the file", async () => {
    const stage = "0";
    const res = await uploadMapImageResponse(db, post({ mapName: "Antarctic Peninsula", stage }, { name: "a.png", bytes: PNG }, 500));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: number };
    expect(await readdir(dir)).toEqual([`${id}.png`]);

    const served = await mapImageResponse(db, String(id));
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);

    expect((await mapImageResponse(db, "abc")).status).toBe(400);
    expect((await mapImageResponse(db, "999999")).status).toBe(404);

    const again = await uploadMapImageResponse(db, post({ mapName: "Antarctic Peninsula", stage }, { name: "b.webp", bytes: WEBP }, 500));
    const { id: id2 } = (await again.json()) as { id: number };
    expect(await readdir(dir)).toEqual([`${id2}.webp`]);
    expect(await getMapImage(db, id)).toBeNull();

    await deleteImageFile(`${id2}.webp`);
    expect(await readdir(dir)).toEqual([]);
    expect((await mapImageResponse(db, String(id2))).status).toBe(404);
    await expect(deleteImageFile("../etc/passwd")).rejects.toThrow();
  });

  it("maps calibrated rows to the replay's image shape", async () => {
    const stages = (await listStagesSeen(db)).filter((s) => s.mapName === "Antarctic Peninsula").map((s) => s.stage);
    expect(stages).toEqual([0, 1, 2]);
    const res = await uploadMapImageResponse(db, post({ mapName: "Antarctic Peninsula", stage: String(stages[1]) }, { name: "c.png", bytes: PNG }, 500));
    const { id } = (await res.json()) as { id: number };
    const row = (await getMapImage(db, id))!;
    expect(calibratedImages([row])).toEqual([]);
    await setCalibration(db, id, JSON.stringify({ pairs: [], affine: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 }, objective: null }), { width: 10, height: 20 });
    expect(calibratedImages([(await getMapImage(db, id))!])).toEqual([{ stage: stages[1], id, width: 10, height: 20, affine: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 } }]);
  });
});
