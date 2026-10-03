import { notFound } from "next/navigation";
import { getDb, type Db } from "@/lib/db";
import { getMap, type MapBanRow, type MapRow, type ScrimRow } from "@/lib/db/queries";
import { parsePositiveInt } from "@/lib/ids";
import { sides, type Sides } from "@/lib/stats/sides";

export type MapParams = Promise<{ scrimId: string; mapId: string }>;

/** Resolves the route params to a map and its scrim, or 404s. Shared by the layout and every map page. */
export async function loadMap(params: MapParams): Promise<{ db: Db; map: MapRow; scrim: ScrimRow; sides: Sides; bans: MapBanRow[] }> {
  const p = await params;
  const scrimId = parsePositiveInt(p.scrimId);
  const mapId = parsePositiveInt(p.mapId);
  if (scrimId === null || mapId === null) notFound();
  const db = await getDb();
  const data = await getMap(db, mapId);
  if (!data || data.scrim.id !== scrimId) notFound();
  return { db, map: data.map, scrim: data.scrim, sides: sides(data.map), bans: data.bans };
}
