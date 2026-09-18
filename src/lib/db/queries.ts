import { asc, count, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import {
  heroSwap, kill, maps, matchEnd, matchStart, mercyRez, objectiveCaptured, playerStat, roundEnd, roundStart, scrims,
  ultimateEnd, ultimateStart,
} from "./schema";

export type ScrimRow = typeof scrims.$inferSelect;
export type MapRow = typeof maps.$inferSelect;
export type PlayerStatRow = typeof playerStat.$inferSelect;
export type KillRow = typeof kill.$inferSelect;
export type RezRow = typeof mercyRez.$inferSelect;
export type RoundEndRow = typeof roundEnd.$inferSelect;
export type RoundStartRow = typeof roundStart.$inferSelect;
export type MatchStartRow = typeof matchStart.$inferSelect;
export type MatchEndRow = typeof matchEnd.$inferSelect;
export type CaptureRow = typeof objectiveCaptured.$inferSelect;
export type SwapRow = typeof heroSwap.$inferSelect;
export type UltStartRow = typeof ultimateStart.$inferSelect;
export type UltEndRow = typeof ultimateEnd.$inferSelect;

export interface ScrimSummary {
  id: number;
  name: string;
  date: string;
  opponentName: string;
  mapCount: number;
  wins: number;
  losses: number;
}

export interface EventRowSet {
  matchStarts: MatchStartRow[];
  matchEnds: MatchEndRow[];
  roundStarts: RoundStartRow[];
  roundEnds: RoundEndRow[];
  captures: CaptureRow[];
  swaps: SwapRow[];
  ultStarts: UltStartRow[];
  ultEnds: UltEndRow[];
  kills: KillRow[];
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

const killsFor = (db: Db, mapId: number) => db.select().from(kill).where(eq(kill.mapId, mapId)).orderBy(asc(kill.matchTime), asc(kill.id));
const roundEndsFor = (db: Db, mapId: number) => db.select().from(roundEnd).where(eq(roundEnd.mapId, mapId)).orderBy(asc(roundEnd.matchTime), asc(roundEnd.id));
const playerStatsFor = (db: Db, mapId: number) => db.select().from(playerStat).where(eq(playerStat.mapId, mapId)).orderBy(asc(playerStat.matchTime), asc(playerStat.id));
const ultEndsFor = (db: Db, mapId: number) => db.select().from(ultimateEnd).where(eq(ultimateEnd.mapId, mapId)).orderBy(asc(ultimateEnd.matchTime), asc(ultimateEnd.id));

export async function getMapStats(db: Db, mapId: number): Promise<{ playerStats: PlayerStatRow[]; kills: KillRow[]; ultimateEnds: UltEndRow[] }> {
  const playerStats = await playerStatsFor(db, mapId);
  const kills = await killsFor(db, mapId);
  const ultimateEnds = await ultEndsFor(db, mapId);
  return { playerStats, kills, ultimateEnds };
}

export async function getKillfeedRows(db: Db, mapId: number): Promise<{ kills: KillRow[]; rezzes: RezRow[]; roundEnds: RoundEndRow[] }> {
  const kills = await killsFor(db, mapId);
  const rezzes = await db.select().from(mercyRez).where(eq(mercyRez.mapId, mapId)).orderBy(asc(mercyRez.matchTime), asc(mercyRez.id));
  const roundEnds = await roundEndsFor(db, mapId);
  return { kills, rezzes, roundEnds };
}

export async function getEventRows(db: Db, mapId: number): Promise<EventRowSet> {
  const matchStarts = await db.select().from(matchStart).where(eq(matchStart.mapId, mapId)).orderBy(asc(matchStart.matchTime), asc(matchStart.id));
  const matchEnds = await db.select().from(matchEnd).where(eq(matchEnd.mapId, mapId)).orderBy(asc(matchEnd.matchTime), asc(matchEnd.id));
  const roundStarts = await db.select().from(roundStart).where(eq(roundStart.mapId, mapId)).orderBy(asc(roundStart.matchTime), asc(roundStart.id));
  const roundEnds = await roundEndsFor(db, mapId);
  const captures = await db.select().from(objectiveCaptured).where(eq(objectiveCaptured.mapId, mapId)).orderBy(asc(objectiveCaptured.matchTime), asc(objectiveCaptured.id));
  const swaps = await db.select().from(heroSwap).where(eq(heroSwap.mapId, mapId)).orderBy(asc(heroSwap.matchTime), asc(heroSwap.id));
  const ultStarts = await db.select().from(ultimateStart).where(eq(ultimateStart.mapId, mapId)).orderBy(asc(ultimateStart.matchTime), asc(ultimateStart.id));
  const ultEnds = await ultEndsFor(db, mapId);
  const kills = await killsFor(db, mapId);
  return { matchStarts, matchEnds, roundStarts, roundEnds, captures, swaps, ultStarts, ultEnds, kills };
}

export async function getChartRows(db: Db, mapId: number): Promise<{ kills: KillRow[]; roundEnds: RoundEndRow[]; playerStats: PlayerStatRow[] }> {
  const kills = await killsFor(db, mapId);
  const roundEnds = await roundEndsFor(db, mapId);
  const playerStats = await playerStatsFor(db, mapId);
  return { kills, roundEnds, playerStats };
}

export async function getCompareRows(db: Db, mapId: number): Promise<{ playerStats: PlayerStatRow[] }> {
  return { playerStats: await playerStatsFor(db, mapId) };
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
