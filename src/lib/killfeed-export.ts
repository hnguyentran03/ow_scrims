import type { Db } from "./db";
import { getKillfeedRows, getMap } from "./db/queries";
import { buildKillfeed } from "./stats/killfeed";
import { killfeedCsv } from "./stats/killfeed-csv";
import { parsePositiveInt } from "./ids";

export function fileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** The killfeed of one map as a CSV attachment; 400 on bad ids, 404 when the map is not under that scrim. */
export async function killfeedCsvResponse(db: Db, params: { scrimId: string; mapId: string }): Promise<Response> {
  const scrimId = parsePositiveInt(params.scrimId);
  const mapId = parsePositiveInt(params.mapId);
  if (scrimId === null || mapId === null) return Response.json({ error: "invalid id" }, { status: 400 });
  const data = await getMap(db, mapId);
  if (!data || data.scrim.id !== scrimId) return Response.json({ error: "map not found" }, { status: 404 });
  const rows = await getKillfeedRows(db, mapId);
  const kf = buildKillfeed({ map: data.map, kills: rows.kills, rezzes: rows.rezzes, roundEnds: rows.roundEnds, durationSeconds: data.map.durationSeconds });
  const filename = `${data.scrim.date}-${fileSlug(data.map.mapName) || "map"}-killfeed.csv`;
  return new Response(killfeedCsv(kf), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
