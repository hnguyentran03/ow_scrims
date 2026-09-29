import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestDb, type Db } from "@/lib/db";
import { createMapImage, createScrim, deleteMapImage, getMapImage, getMapImages, listPositionedStages, listStagesSeen, setCalibration } from "@/lib/db/queries";
import { insertParsedMap } from "@/lib/db/insert-map";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

const upload = async (db: Db, scrimId: number, name: string) => {
  const parsed = parseLog(readFileSync(`test/samples/${name}.txt`, "utf8"));
  return insertParsedMap(db, { scrimId, ourSide: 1, parsed, meta: deriveMapMeta(parsed), originalFilename: `${name}.txt` });
};

describe("map images", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    const scrimId = await createScrim(db, { name: "vs X", date: "2026-09-10", opponentName: "X" });
    await upload(db, scrimId, "Log-2026-04-15-21-12-58"); // Antarctic Peninsula, Control, no positions
    await upload(db, scrimId, "Log-2024-01-10-20-38-42"); // Watchpoint: Gibraltar, Escort
    await upload(db, scrimId, "Log-2026-04-02-17-21-48"); // Lijiang Tower, Control, positions
    await upload(db, scrimId, "Log-2026-09-18-13-52-18"); // Aatlis, Flashpoint
  });

  it("lists every stage seen, one per Control objective and one per single-stage map", async () => {
    const seen = await listStagesSeen(db);
    expect(seen.filter((s) => s.mapName === "Lijiang Tower").map((s) => s.stage)).toEqual([0, 1, 2]);
    expect(seen.filter((s) => s.mapName === "Antarctic Peninsula")).toHaveLength(3);
    expect(seen.find((s) => s.mapName === "Watchpoint: Gibraltar")).toMatchObject({ mapType: "Escort", stage: 0, mapsPlayed: 1, image: null });
    // Round starts (objectiveIndex 0) plus every objective_updated.currentObjectiveIndex (4, 2, 1, 3) in the sample log.
    expect(seen.filter((s) => s.mapName === "Aatlis").map((s) => s.stage)).toEqual([0, 1, 2, 3, 4]);
    expect(seen.filter((s) => s.mapName === "Aatlis").every((s) => s.mapType === "Flashpoint")).toBe(true);
    expect(seen.map((s) => s.mapName)).toEqual([...seen.map((s) => s.mapName)].sort());
  });

  it("creates, calibrates, replaces, and deletes an image row", async () => {
    const calibration = JSON.stringify({ pairs: [], affine: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 }, objective: null });
    const created = await createMapImage(db, { mapName: "Lijiang Tower", stage: 2, ext: "png", contentType: "image/png" });
    expect(created).toEqual({ id: created.id, filename: `${created.id}.png`, replacedFilename: null });
    expect(await setCalibration(db, created.id, calibration, { width: 800, height: 600 })).toBe(true);
    expect(await getMapImage(db, created.id)).toMatchObject({ mapName: "Lijiang Tower", stage: 2, width: 800, height: 600, calibration });
    expect((await listStagesSeen(db)).find((s) => s.mapName === "Lijiang Tower" && s.stage === 2)?.image).toEqual({ id: created.id, calibrated: true });

    expect(await setCalibration(db, created.id, "not json", { width: 800, height: 600 })).toBe(true);
    expect((await listStagesSeen(db)).find((s) => s.mapName === "Lijiang Tower" && s.stage === 2)?.image).toEqual({ id: created.id, calibrated: false });
    expect(await setCalibration(db, created.id, calibration, { width: 800, height: 600 })).toBe(true);

    const beforeFailedReplace = await listStagesSeen(db);
    await expect(
      createMapImage(db, { mapName: "Lijiang Tower", stage: 2, ext: "jpg", contentType: "image/jpeg" }, async () => {
        throw new Error("disk full");
      }),
    ).rejects.toThrow("disk full");
    expect(await getMapImage(db, created.id)).toMatchObject({ filename: `${created.id}.png`, calibration });
    expect(await listStagesSeen(db)).toEqual(beforeFailedReplace);

    const replaced = await createMapImage(db, { mapName: "Lijiang Tower", stage: 2, ext: "jpg", contentType: "image/jpeg" });
    expect(replaced.replacedFilename).toBe(`${created.id}.png`);
    expect(await getMapImage(db, created.id)).toBeNull();
    expect(await getMapImage(db, replaced.id)).toMatchObject({ filename: `${replaced.id}.jpg`, calibration: null, width: null });
    expect((await getMapImages(db, "Lijiang Tower")).map((i) => i.id)).toEqual([replaced.id]);

    expect(await setCalibration(db, 999_999, null)).toBe(false);
    expect((await deleteMapImage(db, replaced.id))?.filename).toBe(`${replaced.id}.jpg`);
    expect(await deleteMapImage(db, replaced.id)).toBeNull();
  });

  it("finds the maps of a base name that have positions, with their round rows", async () => {
    const lijiang = await listPositionedStages(db, "Lijiang Tower");
    expect(lijiang).toHaveLength(1);
    expect(lijiang[0].roundStarts.map((r) => r.objectiveIndex)).toEqual([2, 0, 1]);
    expect(lijiang[0].scrimName).toBe("vs X");
    expect(await listPositionedStages(db, "Antarctic Peninsula")).toEqual([]);
  });
});
