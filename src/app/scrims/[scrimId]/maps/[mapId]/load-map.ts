import { notFound } from "next/navigation";
import { getDb, type Db } from "@/lib/db";
import { getMap, type MapRow, type ScrimRow } from "@/lib/db/queries";
import { sides, type Sides } from "@/lib/stats/sides";

export type MapParams = Promise<{ scrimId: string; mapId: string }>;

/** Resolves the route params to a map and its scrim, or 404s. Shared by the layout and every map page. */
export async function loadMap(params: MapParams): Promise<{ db: Db; map: MapRow; scrim: ScrimRow; sides: Sides }> {
  const p = await params;
  const scrimId = Number(p.scrimId);
  const mapId = Number(p.mapId);
  if (!Number.isInteger(scrimId) || !Number.isInteger(mapId)) notFound();
  const db = await getDb();
  const data = await getMap(db, mapId);
  if (!data || data.scrim.id !== scrimId) notFound();
  return { db, map: data.map, scrim: data.scrim, sides: sides(data.map) };
}
