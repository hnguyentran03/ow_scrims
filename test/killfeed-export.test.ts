import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestDb, type Db } from "@/lib/db";
import { createScrim } from "@/lib/db/queries";
import { insertParsedMap } from "@/lib/db/insert-map";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";
import { fileSlug, killfeedCsvResponse } from "@/lib/killfeed-export";

describe("fileSlug", () => {
  it("lower-cases and reduces to letters, digits, and single dashes", () => {
    expect(fileSlug("Watchpoint: Gibraltar")).toBe("watchpoint-gibraltar");
    expect(fileSlug("King's Row")).toBe("king-s-row");
    expect(fileSlug("  Ilios ")).toBe("ilios");
  });
});

describe("killfeedCsvResponse", () => {
  let db: Db;
  let scrimId: number;
  let mapId: number;

  beforeAll(async () => {
    db = await createTestDb();
    scrimId = await createScrim(db, { name: "vs Cerberus", date: "2026-09-10", opponentName: "Cerberus" });
    const parsed = parseLog(readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8"));
    mapId = await insertParsedMap(db, { scrimId, ourSide: 2, parsed, meta: deriveMapMeta(parsed), originalFilename: "a.txt" });
  });

  it("rejects ids that are not positive integers", async () => {
    for (const params of [
      { scrimId: "abc", mapId: String(mapId) },
      { scrimId: "0", mapId: String(mapId) },
      { scrimId: String(scrimId), mapId: "1.5" },
      { scrimId: String(scrimId), mapId: "2147483648" },
      { scrimId: String(scrimId), mapId: "9999999999" },
      { scrimId: String(scrimId), mapId: " 5 " },
      { scrimId: String(scrimId), mapId: "5e0" },
      { scrimId: String(scrimId), mapId: "0x5" },
      { scrimId: String(scrimId), mapId: "007" },
    ]) {
      const res = await killfeedCsvResponse(db, params);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid id" });
    }
  });

  it("404s for a missing map or a map under another scrim", async () => {
    expect((await killfeedCsvResponse(db, { scrimId: String(scrimId), mapId: "999999" })).status).toBe(404);
    expect((await killfeedCsvResponse(db, { scrimId: String(scrimId + 1), mapId: String(mapId) })).status).toBe(404);
  });

  it("serves the CSV as an attachment named after the scrim date and map", async () => {
    const res = await killfeedCsvResponse(db, { scrimId: String(scrimId), mapId: String(mapId) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="2026-09-10-antarctic-peninsula-killfeed.csv"');
    const lines = (await res.text()).split("\r\n");
    expect(lines[0]).toBe('"fight","round","time","kind","attacker_team","attacker","attacker_hero","victim_team","victim","victim_hero","method","critical"');
    expect(lines).toHaveLength(60);
  });
});
