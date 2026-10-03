import { and, asc, count, desc, eq, getTableColumns, gte, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import type { Db } from "./index";
import {
  ability1Used, ability2Used, damage, healing, heroSpawn, heroSwap, kill, mapBans, mapImages, maps, matchEnd, matchStart, mercyRez, objectiveCaptured,
  objectiveUpdated, playerStat, roundEnd, roundStart, scrims, ultimateCharged, ultimateEnd, ultimateStart,
} from "./schema";
import type { DamageLite } from "@/lib/stats/initiation";
import { isCalibrated } from "@/lib/stats/calibration";
import type { AbilityLike } from "@/lib/stats/ability-impact";
import type { MapKeyed } from "@/lib/stats/team-rows";

export type { DamageLite };

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
export type MapBanRow = typeof mapBans.$inferSelect;
export type UltChargedRow = typeof ultimateCharged.$inferSelect;
export type DamageRow = typeof damage.$inferSelect;
export type HealingRow = typeof healing.$inferSelect;
export type AbilityRow = typeof ability1Used.$inferSelect;
export type SpawnRow = typeof heroSpawn.$inferSelect;
export type ObjectiveUpdatedRow = typeof objectiveUpdated.$inferSelect;
export type MapImageRow = typeof mapImages.$inferSelect;

/** Inclusive YYYY-MM-DD bounds on the scrim date; either may be absent. */
export interface DateRange {
  from?: string;
  to?: string;
}

export interface TeamMapRow extends MapRow {
  scrimName: string;
  scrimDate: string;
}

export interface TeamRows {
  maps: TeamMapRow[];
  kills: KillRow[];
  ultStarts: UltStartRow[];
  ultEnds: UltEndRow[];
  ultCharged: UltChargedRow[];
  playerStats: PlayerStatRow[];
  bans: MapBanRow[];
  abilities: (AbilityLike & MapKeyed)[];
  roundStarts: RoundStartRow[];
  damage: (DamageLite & MapKeyed)[];
}

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

export async function getScrim(db: Db, id: number): Promise<{ scrim: ScrimRow; maps: MapRow[]; bans: MapBanRow[] } | null> {
  const [scrim] = await db.select().from(scrims).where(eq(scrims.id, id));
  if (!scrim) return null;
  const mapRows = await db.select().from(maps).where(eq(maps.scrimId, id)).orderBy(asc(maps.order));
  const bans = mapRows.length === 0 ? [] : await db.select().from(mapBans).where(inArray(mapBans.mapId, mapRows.map((m) => m.id))).orderBy(asc(mapBans.id));
  return { scrim, maps: mapRows, bans };
}

export async function getMap(db: Db, id: number): Promise<{ map: MapRow; scrim: ScrimRow; bans: MapBanRow[] } | null> {
  const [row] = await db.select({ map: maps, scrim: scrims }).from(maps).innerJoin(scrims, eq(scrims.id, maps.scrimId)).where(eq(maps.id, id));
  if (!row) return null;
  const bans = await db.select().from(mapBans).where(eq(mapBans.mapId, id)).orderBy(asc(mapBans.id));
  return { ...row, bans };
}

const killsFor = (db: Db, mapId: number) => db.select().from(kill).where(eq(kill.mapId, mapId)).orderBy(asc(kill.matchTime), asc(kill.id));
const roundEndsFor = (db: Db, mapId: number) => db.select().from(roundEnd).where(eq(roundEnd.mapId, mapId)).orderBy(asc(roundEnd.matchTime), asc(roundEnd.id));
const playerStatsFor = (db: Db, mapId: number) => db.select().from(playerStat).where(eq(playerStat.mapId, mapId)).orderBy(asc(playerStat.matchTime), asc(playerStat.id));
const ultEndsFor = (db: Db, mapId: number) => db.select().from(ultimateEnd).where(eq(ultimateEnd.mapId, mapId)).orderBy(asc(ultimateEnd.matchTime), asc(ultimateEnd.id));
const ultStartsFor = (db: Db, mapId: number) => db.select().from(ultimateStart).where(eq(ultimateStart.mapId, mapId)).orderBy(asc(ultimateStart.matchTime), asc(ultimateStart.id));
const ultChargedFor = (db: Db, mapId: number) => db.select().from(ultimateCharged).where(eq(ultimateCharged.mapId, mapId)).orderBy(asc(ultimateCharged.matchTime), asc(ultimateCharged.id));

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
  const ultStarts = await ultStartsFor(db, mapId);
  const ultEnds = await ultEndsFor(db, mapId);
  const kills = await killsFor(db, mapId);
  return { matchStarts, matchEnds, roundStarts, roundEnds, captures, swaps, ultStarts, ultEnds, kills };
}

export interface ChartRows {
  kills: KillRow[];
  roundEnds: RoundEndRow[];
  playerStats: PlayerStatRow[];
  ultStarts: UltStartRow[];
  ultEnds: UltEndRow[];
  ultCharged: UltChargedRow[];
}

export async function getChartRows(db: Db, mapId: number): Promise<ChartRows> {
  const kills = await killsFor(db, mapId);
  const roundEnds = await roundEndsFor(db, mapId);
  const playerStats = await playerStatsFor(db, mapId);
  const ultStarts = await ultStartsFor(db, mapId);
  const ultEnds = await ultEndsFor(db, mapId);
  const ultCharged = await ultChargedFor(db, mapId);
  return { kills, roundEnds, playerStats, ultStarts, ultEnds, ultCharged };
}

export async function getCompareRows(db: Db, mapId: number): Promise<{ playerStats: PlayerStatRow[] }> {
  return { playerStats: await playerStatsFor(db, mapId) };
}

export async function getTelemetryRows(db: Db, mapId: number): Promise<{ damage: DamageRow[]; playerStats: PlayerStatRow[] }> {
  const damageRows = await db.select().from(damage).where(eq(damage.mapId, mapId)).orderBy(asc(damage.matchTime), asc(damage.id));
  const playerStats = await playerStatsFor(db, mapId);
  return { damage: damageRows, playerStats };
}

/** The five damage columns initiation needs, in match-time order. Kills come from the page's own row set. */
export async function getInitiationDamage(db: Db, mapId: number): Promise<DamageLite[]> {
  return db
    .select({ matchTime: damage.matchTime, attackerTeam: damage.attackerTeam, attackerName: damage.attackerName, attackerHero: damage.attackerHero, victimTeam: damage.victimTeam })
    .from(damage)
    .where(eq(damage.mapId, mapId))
    .orderBy(asc(damage.matchTime), asc(damage.id));
}

/** Every row the replay tab needs: the events set plus positions (damage, healing, abilities), spawns, charge, and stats. */
export interface ReplayRows extends EventRowSet {
  rezzes: RezRow[];
  damage: DamageRow[];
  healing: HealingRow[];
  ability1: AbilityRow[];
  ability2: AbilityRow[];
  ultCharged: UltChargedRow[];
  heroSwaps: SwapRow[];
  heroSpawns: SpawnRow[];
  objectiveUpdated: ObjectiveUpdatedRow[];
  playerStats: PlayerStatRow[];
}

export async function getReplayRows(db: Db, mapId: number): Promise<ReplayRows> {
  const events = await getEventRows(db, mapId);
  const rezzes = await db.select().from(mercyRez).where(eq(mercyRez.mapId, mapId)).orderBy(asc(mercyRez.matchTime), asc(mercyRez.id));
  const damageRows = await db.select().from(damage).where(eq(damage.mapId, mapId)).orderBy(asc(damage.matchTime), asc(damage.id));
  const healingRows = await db.select().from(healing).where(eq(healing.mapId, mapId)).orderBy(asc(healing.matchTime), asc(healing.id));
  const ability1 = await db.select().from(ability1Used).where(eq(ability1Used.mapId, mapId)).orderBy(asc(ability1Used.matchTime), asc(ability1Used.id));
  const ability2 = await db.select().from(ability2Used).where(eq(ability2Used.mapId, mapId)).orderBy(asc(ability2Used.matchTime), asc(ability2Used.id));
  const ultCharged = await ultChargedFor(db, mapId);
  const heroSpawns = await db.select().from(heroSpawn).where(eq(heroSpawn.mapId, mapId)).orderBy(asc(heroSpawn.matchTime), asc(heroSpawn.id));
  const updates = await db.select().from(objectiveUpdated).where(eq(objectiveUpdated.mapId, mapId)).orderBy(asc(objectiveUpdated.matchTime), asc(objectiveUpdated.id));
  const playerStats = await playerStatsFor(db, mapId);
  return { ...events, rezzes, damage: damageRows, healing: healingRows, ability1, ability2, ultCharged, heroSwaps: events.swaps, heroSpawns, objectiveUpdated: updates, playerStats };
}

export async function setMapBans(db: Db, mapId: number, side: 1 | 2, heroes: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(mapBans).where(and(eq(mapBans.mapId, mapId), eq(mapBans.side, side)));
    if (heroes.length > 0) await tx.insert(mapBans).values(heroes.map((hero) => ({ mapId, side, hero })));
  });
}

/** The name of our team on a map, whichever side we were on. */
const OUR_TEAM = sql`case when ${maps.ourSide} = 1 then ${maps.team1Name} else ${maps.team2Name} end`;

/** Distinct player names on our side over the `limit` most recently uploaded maps. Feeds side inference for bulk upload. */
export async function recentOurRoster(db: Db, limit = 20): Promise<Set<string>> {
  const recent = db.select({ id: maps.id }).from(maps).orderBy(desc(maps.uploadedAt), desc(maps.id)).limit(limit);
  const rows = await db
    .selectDistinct({ name: playerStat.playerName })
    .from(playerStat)
    .innerJoin(maps, eq(maps.id, playerStat.mapId))
    .where(and(inArray(playerStat.mapId, recent), eq(playerStat.playerTeam, OUR_TEAM)));
  return new Set(rows.map((r) => r.name));
}

/** Every distinct name that ever played on our side, across every map. Tells an off-range teammate from a stranger. */
export async function ourRoster(db: Db): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ name: playerStat.playerName })
    .from(playerStat)
    .innerJoin(maps, eq(maps.id, playerStat.mapId))
    .where(eq(playerStat.playerTeam, OUR_TEAM));
  return new Set(rows.map((r) => r.name));
}

/** Which event tables a team page needs. Omitted tables come back as empty arrays and are never queried. */
export interface TeamTables {
  kills?: boolean;
  ults?: boolean; // ultimate_start and ultimate_end
  charged?: boolean; // ultimate_charged
  playerStats?: boolean;
  bans?: boolean;
  abilities?: boolean; // ability_1_used and ability_2_used, merged in time order
  rounds?: boolean; // round_start
  damage?: boolean; // the five initiation columns only; about fifty times the kill volume
}

export const ALL_TEAM_TABLES: TeamTables = { kills: true, ults: true, charged: true, playerStats: true, bans: true, abilities: true, rounds: true, damage: true };

/** Both ability tables for the given maps, five columns each, merged by match time with slot 1 first on a tie. */
async function abilitiesFor(db: Db, ids: number[]): Promise<(AbilityLike & MapKeyed)[]> {
  const cols = (t: typeof ability1Used | typeof ability2Used) => ({ mapId: t.mapId, matchTime: t.matchTime, playerTeam: t.playerTeam, playerName: t.playerName, playerHero: t.playerHero });
  const [a1, a2] = await Promise.all([
    db.select(cols(ability1Used)).from(ability1Used).where(inArray(ability1Used.mapId, ids)).orderBy(asc(ability1Used.matchTime), asc(ability1Used.id)),
    db.select(cols(ability2Used)).from(ability2Used).where(inArray(ability2Used.mapId, ids)).orderBy(asc(ability2Used.matchTime), asc(ability2Used.id)),
  ]);
  return [...a1.map((r) => ({ ...r, slot: 1 as const })), ...a2.map((r) => ({ ...r, slot: 2 as const }))].sort((x, y) => x.matchTime - y.matchTime || x.slot - y.slot);
}

/** Maps in the date range (scrim date, scrim id, map order) and, for those maps only, the rows requested in `tables`; omitted tables come back as empty arrays and are never queried. */
export async function getTeamRows(db: Db, range: DateRange = {}, tables: TeamTables = ALL_TEAM_TABLES): Promise<TeamRows> {
  const conditions: SQL[] = [];
  if (range.from) conditions.push(gte(scrims.date, range.from));
  if (range.to) conditions.push(lte(scrims.date, range.to));
  const mapRows: TeamMapRow[] = await db
    .select({ ...getTableColumns(maps), scrimName: scrims.name, scrimDate: scrims.date })
    .from(maps)
    .innerJoin(scrims, eq(scrims.id, maps.scrimId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(scrims.date), asc(scrims.id), asc(maps.order));
  const ids = mapRows.map((m) => m.id);
  if (ids.length === 0) {
    return { maps: mapRows, kills: [], ultStarts: [], ultEnds: [], ultCharged: [], playerStats: [], bans: [], abilities: [], roundStarts: [], damage: [] };
  }
  const kills = tables.kills ? await db.select().from(kill).where(inArray(kill.mapId, ids)).orderBy(asc(kill.matchTime), asc(kill.id)) : [];
  const ultStarts = tables.ults
    ? await db.select().from(ultimateStart).where(inArray(ultimateStart.mapId, ids)).orderBy(asc(ultimateStart.matchTime), asc(ultimateStart.id))
    : [];
  const ultEnds = tables.ults
    ? await db.select().from(ultimateEnd).where(inArray(ultimateEnd.mapId, ids)).orderBy(asc(ultimateEnd.matchTime), asc(ultimateEnd.id))
    : [];
  const ultCharged = tables.charged
    ? await db.select().from(ultimateCharged).where(inArray(ultimateCharged.mapId, ids)).orderBy(asc(ultimateCharged.matchTime), asc(ultimateCharged.id))
    : [];
  const playerStats = tables.playerStats
    ? await db.select().from(playerStat).where(inArray(playerStat.mapId, ids)).orderBy(asc(playerStat.matchTime), asc(playerStat.id))
    : [];
  const bans = tables.bans ? await db.select().from(mapBans).where(inArray(mapBans.mapId, ids)).orderBy(asc(mapBans.id)) : [];
  const abilities = tables.abilities ? await abilitiesFor(db, ids) : [];
  const roundStarts = tables.rounds
    ? await db.select().from(roundStart).where(inArray(roundStart.mapId, ids)).orderBy(asc(roundStart.matchTime), asc(roundStart.id))
    : [];
  const damageRows = tables.damage
    ? await db
        .select({ mapId: damage.mapId, matchTime: damage.matchTime, attackerTeam: damage.attackerTeam, attackerName: damage.attackerName, attackerHero: damage.attackerHero, victimTeam: damage.victimTeam })
        .from(damage)
        .where(inArray(damage.mapId, ids))
        .orderBy(asc(damage.matchTime), asc(damage.id))
    : [];
  return { maps: mapRows, kills, ultStarts, ultEnds, ultCharged, playerStats, bans, abilities, roundStarts, damage: damageRows };
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

export async function getMapImages(db: Db, mapName: string): Promise<MapImageRow[]> {
  return db.select().from(mapImages).where(eq(mapImages.mapName, mapName)).orderBy(asc(mapImages.stage));
}

export async function getMapImage(db: Db, id: number): Promise<MapImageRow | null> {
  const [row] = await db.select().from(mapImages).where(eq(mapImages.id, id));
  return row ?? null;
}

/**
 * Inserts an image row for the pair, replacing (and un-calibrating) any existing one. The file name is derived from
 * the new id. When given, `persist` is awaited inside the transaction after the filename update, so a failed write
 * (e.g. disk full) rolls back the delete and insert instead of losing the previous row.
 */
export async function createMapImage(
  db: Db,
  input: { mapName: string; stage: number; ext: string; contentType: string },
  persist?: (filename: string) => Promise<void>,
): Promise<{ id: number; filename: string; replacedFilename: string | null }> {
  return db.transaction(async (tx) => {
    const [old] = await tx.delete(mapImages).where(and(eq(mapImages.mapName, input.mapName), eq(mapImages.stage, input.stage))).returning({ filename: mapImages.filename });
    const [inserted] = await tx.insert(mapImages).values({ mapName: input.mapName, stage: input.stage, filename: "", contentType: input.contentType }).returning({ id: mapImages.id });
    const filename = `${inserted.id}.${input.ext}`;
    await tx.update(mapImages).set({ filename }).where(eq(mapImages.id, inserted.id));
    if (persist) await persist(filename);
    return { id: inserted.id, filename, replacedFilename: old?.filename ?? null };
  });
}

export async function setCalibration(db: Db, id: number, calibration: string | null, size?: { width: number; height: number }): Promise<boolean> {
  const rows = await db.update(mapImages).set({ calibration, ...(size ?? {}) }).where(eq(mapImages.id, id)).returning({ id: mapImages.id });
  return rows.length > 0;
}

export async function deleteMapImage(db: Db, id: number): Promise<MapImageRow | null> {
  const [row] = await db.delete(mapImages).where(eq(mapImages.id, id)).returning();
  return row ?? null;
}

export interface StageSeen {
  mapName: string;
  mapType: string;
  stage: number;
  mapsPlayed: number;
  image: { id: number; calibrated: boolean } | null;
}

/**
 * Every (base map, stage) pair any stored map has played, with its image status. The only place images can be created for.
 * Control and Flashpoint maps with no round rows still list stage 0, matching stageWindows' own fallback.
 */
export async function listStagesSeen(db: Db): Promise<StageSeen[]> {
  const mapRows = await db.select({ id: maps.id, mapName: maps.mapName, mapType: maps.mapType }).from(maps);
  const ids = mapRows.map((m) => m.id);
  const starts = ids.length === 0 ? [] : await db.select({ mapId: roundStart.mapId, stage: roundStart.objectiveIndex }).from(roundStart).where(inArray(roundStart.mapId, ids));
  const updates = ids.length === 0 ? [] : await db.select({ mapId: objectiveUpdated.mapId, stage: objectiveUpdated.currentObjectiveIndex }).from(objectiveUpdated).where(inArray(objectiveUpdated.mapId, ids));
  const images = await db.select().from(mapImages);
  const seen = new Map<string, StageSeen & { mapIds: Set<number> }>();
  const add = (m: (typeof mapRows)[number], stage: number) => {
    const key = `${m.mapName}|${stage}`;
    const entry = seen.get(key) ?? { mapName: m.mapName, mapType: m.mapType, stage, mapsPlayed: 0, image: null, mapIds: new Set<number>() };
    entry.mapIds.add(m.id);
    seen.set(key, entry);
  };
  for (const m of mapRows) {
    if (m.mapType === "Control" || m.mapType === "Flashpoint") {
      // A staged map with no deduped round-start rows (e.g. a log that ended before one) still gets a stage-0 entry,
      // matching stageWindows' own fallback to a single stage-0 window.
      let added = false;
      for (const s of starts) if (s.mapId === m.id) { add(m, s.stage); added = true; }
      if (m.mapType === "Flashpoint") for (const u of updates) if (u.mapId === m.id) { add(m, u.stage); added = true; }
      if (!added) add(m, 0);
    } else {
      add(m, 0);
    }
  }
  return [...seen.values()]
    .map(({ mapIds, ...entry }) => {
      const image = images.find((i) => i.mapName === entry.mapName && i.stage === entry.stage);
      return { ...entry, mapsPlayed: mapIds.size, image: image ? { id: image.id, calibrated: isCalibrated(image) } : null };
    })
    .sort((a, b) => a.mapName.localeCompare(b.mapName) || a.stage - b.stage);
}

export interface PositionedMap {
  map: MapRow;
  scrimName: string;
  scrimDate: string;
  roundStarts: RoundStartRow[];
  roundEnds: RoundEndRow[];
  objectiveUpdated: ObjectiveUpdatedRow[];
}

/** Maps of a base name that logged at least one position (kill, damage, or healing), newest scrim first, with the rows stageWindows needs. */
export async function listPositionedStages(db: Db, mapName: string): Promise<PositionedMap[]> {
  const positioned = sql`(
    exists (select 1 from ${kill} where ${kill.mapId} = ${maps.id} and ${kill.attackerPosition} is not null)
    or exists (select 1 from ${damage} where ${damage.mapId} = ${maps.id} and ${damage.attackerPosition} is not null)
    or exists (select 1 from ${healing} where ${healing.mapId} = ${maps.id} and ${healing.healerPosition} is not null)
  )`;
  const rows = await db
    .select({ map: maps, scrimName: scrims.name, scrimDate: scrims.date })
    .from(maps)
    .innerJoin(scrims, eq(scrims.id, maps.scrimId))
    .where(and(eq(maps.mapName, mapName), positioned))
    .orderBy(desc(scrims.date), desc(scrims.id), desc(maps.order));
  const ids = rows.map((r) => r.map.id);
  if (ids.length === 0) return [];
  const starts = await db.select().from(roundStart).where(inArray(roundStart.mapId, ids)).orderBy(asc(roundStart.matchTime), asc(roundStart.id));
  const ends = await db.select().from(roundEnd).where(inArray(roundEnd.mapId, ids)).orderBy(asc(roundEnd.matchTime), asc(roundEnd.id));
  const updates = await db.select().from(objectiveUpdated).where(inArray(objectiveUpdated.mapId, ids)).orderBy(asc(objectiveUpdated.matchTime), asc(objectiveUpdated.id));
  return rows.map((r) => ({
    ...r,
    roundStarts: starts.filter((s) => s.mapId === r.map.id),
    roundEnds: ends.filter((e) => e.mapId === r.map.id),
    objectiveUpdated: updates.filter((u) => u.mapId === r.map.id),
  }));
}

/**
 * Every other map with the same base name, newest scrim first, with the round-window rows the ghost
 * picker needs. Unlike the map-images PR's `listPositionedStages`, this does not filter to maps with
 * positions — `ghostFrom` already handles a source with no samples by yielding empty segments. Once
 * both land, `listPositionedStages` supersedes this.
 */
export async function listSameMapReplays(
  db: Db,
  mapName: string,
  exceptMapId: number,
): Promise<Array<{ map: MapRow; scrimName: string; scrimDate: string; roundStarts: RoundStartRow[]; roundEnds: RoundEndRow[]; objectiveUpdated: ObjectiveUpdatedRow[] }>> {
  const rows = await db
    .select({ map: maps, scrimName: scrims.name, scrimDate: scrims.date })
    .from(maps)
    .innerJoin(scrims, eq(scrims.id, maps.scrimId))
    .where(and(eq(maps.mapName, mapName), ne(maps.id, exceptMapId)))
    .orderBy(desc(scrims.date), desc(scrims.id), desc(maps.order));
  return Promise.all(
    rows.map(async (r) => {
      const roundStarts = await db.select().from(roundStart).where(eq(roundStart.mapId, r.map.id)).orderBy(asc(roundStart.matchTime), asc(roundStart.id));
      const roundEnds = await roundEndsFor(db, r.map.id);
      const objectiveUpdatedRows = await db
        .select()
        .from(objectiveUpdated)
        .where(eq(objectiveUpdated.mapId, r.map.id))
        .orderBy(asc(objectiveUpdated.matchTime), asc(objectiveUpdated.id));
      return { map: r.map, scrimName: r.scrimName, scrimDate: r.scrimDate, roundStarts, roundEnds, objectiveUpdated: objectiveUpdatedRows };
    }),
  );
}
