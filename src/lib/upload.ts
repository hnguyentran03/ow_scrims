import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { DuplicateMapError, insertParsedMap } from "@/lib/db/insert-map";
import { recentOurRoster } from "@/lib/db/queries";
import { maps, scrims } from "@/lib/db/schema";
import { writeRawLog } from "@/lib/logs";
import { deriveMapMeta, type MapMeta, type Side } from "@/lib/parser/derive";
import { ParseError } from "@/lib/parser/errors";
import { parseLog, type ParsedLog } from "@/lib/parser/parse";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSION = /\.(txt|log)$/i;

/** A side is chosen when it shares at least this many names with the roster… */
export const ROSTER_MIN_MATCH = 3;
/** …and the other side shares at most this many. */
export const ROSTER_MAX_OTHER = 1;
const CENSORED = "0";

export class UploadError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 422, readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = "UploadError";
  }
}

export interface UploadResult {
  mapId: number;
  mapName: string;
  warnings: string[];
}

export interface Rosters {
  team1Name: string;
  team2Name: string;
  team1: string[];
  team2: string[];
}

export function rostersOf(parsed: ParsedLog, meta: MapMeta): Rosters {
  const names = (team: string) =>
    [...new Set((parsed.events.player_stat ?? []).filter((r) => String(r.playerTeam) === team).map((r) => String(r.playerName)))].filter((n) => n !== CENSORED);
  return { team1Name: meta.team1Name, team2Name: meta.team2Name, team1: names(meta.team1Name), team2: names(meta.team2Name) };
}

/** Which side is ours, judged by overlap with the names seen on our side before. Null when the overlap is ambiguous. */
export function chooseSide(rosters: Rosters, known: Set<string>): Side | null {
  const score = (names: string[]) => names.filter((n) => n !== CENSORED && known.has(n)).length;
  const s1 = score(rosters.team1);
  const s2 = score(rosters.team2);
  if (s1 >= ROSTER_MIN_MATCH && s2 <= ROSTER_MAX_OTHER) return 1;
  if (s2 >= ROSTER_MIN_MATCH && s1 <= ROSTER_MAX_OTHER) return 2;
  return null;
}

export async function handleUpload(db: Db, input: { scrimId: number; file: File; ourSide: Side | "auto"; logDir?: string }): Promise<UploadResult> {
  const { scrimId, file } = input;

  const [scrim] = await db.select({ id: scrims.id }).from(scrims).where(eq(scrims.id, scrimId));
  if (!scrim) throw new UploadError("scrim not found", 404);

  if (!ALLOWED_EXTENSION.test(file.name)) throw new UploadError("upload a .txt or .log Workshop log", 400);
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("file is larger than 50MB", 400);

  const bytes = Buffer.from(await file.arrayBuffer());
  const text = bytes.toString("utf8");

  let parsed: ParsedLog;
  let meta: MapMeta;
  try {
    parsed = parseLog(text);
    meta = deriveMapMeta(parsed);
  } catch (err) {
    if (err instanceof ParseError) throw new UploadError(err.message, 400);
    throw err;
  }

  let ourSide: Side;
  if (input.ourSide === "auto") {
    const rosters = rostersOf(parsed, meta);
    const chosen = chooseSide(rosters, await recentOurRoster(db));
    if (chosen === null) throw new UploadError("could not tell which team was yours", 422, { needsSide: true, ...rosters });
    ourSide = chosen;
  } else {
    ourSide = input.ourSide;
  }

  let mapId: number;
  try {
    mapId = await insertParsedMap(db, { scrimId, ourSide, parsed, meta, originalFilename: file.name });
  } catch (err) {
    if (err instanceof DuplicateMapError) throw new UploadError(err.message, 400);
    throw err;
  }

  const rawLogPath = await writeRawLog(mapId, bytes, input.logDir);
  await db.update(maps).set({ rawLogPath }).where(eq(maps.id, mapId));

  return { mapId, mapName: meta.mapName, warnings: parsed.warnings };
}
