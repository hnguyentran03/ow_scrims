import { asc, count, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { kill, maps, playerStat, scrims } from "./schema";

export type ScrimRow = typeof scrims.$inferSelect;
export type MapRow = typeof maps.$inferSelect;
export type PlayerStatRow = typeof playerStat.$inferSelect;
export type KillRow = typeof kill.$inferSelect;

export interface ScrimSummary {
  id: number;
  name: string;
  date: string;
  opponentName: string;
  mapCount: number;
  wins: number;
  losses: number;
}

export async function createScrim(db: Db, input: { name: string; date: string; opponentName: string }): Promise<number> {
  const [row] = await db.insert(scrims).values(input).returning({ id: scrims.id });
  return row.id;
}

export async function listScrims(db: Db): Promise<ScrimSummary[]> {
  return db
    .select({
      id: scrims.id,
      name: scrims.name,
      date: scrims.date,
      opponentName: scrims.opponentName,
      mapCount: count(maps.id),
      wins: sql<number>`count(*) filter (where ${maps.winnerSide} = ${maps.ourSide})`.mapWith(Number),
      losses: sql<number>`count(*) filter (where ${maps.winnerSide} is not null and ${maps.winnerSide} <> ${maps.ourSide})`.mapWith(Number),
    })
    .from(scrims)
    .leftJoin(maps, eq(maps.scrimId, scrims.id))
    .groupBy(scrims.id)
    .orderBy(desc(scrims.date), desc(scrims.id));
}

export async function getScrim(db: Db, id: number): Promise<{ scrim: ScrimRow; maps: MapRow[] } | null> {
  const [scrim] = await db.select().from(scrims).where(eq(scrims.id, id));
  if (!scrim) return null;
  const mapRows = await db.select().from(maps).where(eq(maps.scrimId, id)).orderBy(asc(maps.order));
  return { scrim, maps: mapRows };
}

export async function getMap(db: Db, id: number): Promise<{ map: MapRow; scrim: ScrimRow } | null> {
  const [row] = await db.select({ map: maps, scrim: scrims }).from(maps).innerJoin(scrims, eq(scrims.id, maps.scrimId)).where(eq(maps.id, id));
  return row ?? null;
}

export async function getMapStats(db: Db, mapId: number): Promise<{ playerStats: PlayerStatRow[]; kills: KillRow[] }> {
  const playerStats = await db.select().from(playerStat).where(eq(playerStat.mapId, mapId));
  const kills = await db.select().from(kill).where(eq(kill.mapId, mapId)).orderBy(asc(kill.matchTime), asc(kill.id));
  return { playerStats, kills };
}

export async function setMapWinner(db: Db, mapId: number, side: 1 | 2): Promise<void> {
  await db.update(maps).set({ winnerSide: side, winnerSource: "manual" }).where(eq(maps.id, mapId));
}

/** Deletes a map (events cascade) and returns its raw log path for file cleanup. */
export async function deleteMap(db: Db, mapId: number): Promise<string | null> {
  const [row] = await db.delete(maps).where(eq(maps.id, mapId)).returning({ rawLogPath: maps.rawLogPath });
  return row?.rawLogPath ?? null;
}

/** Deletes a scrim (maps and events cascade) and returns all raw log paths for file cleanup. */
export async function deleteScrim(db: Db, id: number): Promise<string[]> {
  const rows = await db.select({ rawLogPath: maps.rawLogPath }).from(maps).where(eq(maps.scrimId, id));
  await db.delete(scrims).where(eq(scrims.id, id));
  return rows.map((r) => r.rawLogPath).filter((p): p is string => p !== null);
}
