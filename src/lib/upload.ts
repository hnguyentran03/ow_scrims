import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { DuplicateMapError, insertParsedMap } from "@/lib/db/insert-map";
import { maps, scrims } from "@/lib/db/schema";
import { writeRawLog } from "@/lib/logs";
import { deriveMapMeta, type MapMeta, type Side } from "@/lib/parser/derive";
import { ParseError } from "@/lib/parser/errors";
import { parseLog, type ParsedLog } from "@/lib/parser/parse";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSION = /\.(txt|log)$/i;

export class UploadError extends Error {
  constructor(message: string, readonly status: 400 | 404) {
    super(message);
    this.name = "UploadError";
  }
}

export interface UploadResult {
  mapId: number;
  warnings: string[];
}

export async function handleUpload(db: Db, input: { scrimId: number; file: File; ourSide: Side }): Promise<UploadResult> {
  const { scrimId, file, ourSide } = input;

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

  let mapId: number;
  try {
    mapId = await insertParsedMap(db, { scrimId, ourSide, parsed, meta, originalFilename: file.name });
  } catch (err) {
    if (err instanceof DuplicateMapError) throw new UploadError(err.message, 400);
    throw err;
  }

  const rawLogPath = await writeRawLog(mapId, bytes);
  await db.update(maps).set({ rawLogPath }).where(eq(maps.id, mapId));

  return { mapId, warnings: parsed.warnings };
}
