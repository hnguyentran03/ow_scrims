import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./db";
import { createMapImage, getMapImage, listStagesSeen, type MapImageRow } from "./db/queries";
import { parsePositiveInt } from "./ids";
import { isCalibrated, parseCalibration } from "./stats/calibration";
import type { CalibratedImage } from "./stats/replay";

export { isCalibrated };

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ImageType {
  ext: "png" | "jpg" | "webp";
  contentType: string;
}

const BY_EXTENSION: Record<string, ImageType> = {
  png: { ext: "png", contentType: "image/png" },
  jpg: { ext: "jpg", contentType: "image/jpeg" },
  jpeg: { ext: "jpg", contentType: "image/jpeg" },
  webp: { ext: "webp", contentType: "image/webp" },
};

const startsWith = (bytes: Uint8Array, prefix: number[], at = 0) => prefix.every((b, i) => bytes[at + i] === b);

function sniff(bytes: Uint8Array): ImageType["ext"] | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

/** The image type when the file's extension and its magic bytes agree, else null. */
export function detectImageType(bytes: Uint8Array, filename: string): ImageType | null {
  const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? "";
  const declared = Object.hasOwn(BY_EXTENSION, ext) ? BY_EXTENSION[ext] : undefined;
  if (!declared || sniff(bytes) !== declared.ext) return null;
  return declared;
}

export function imageDir(): string {
  return process.env.MAP_IMAGE_DIR ?? path.join(process.cwd(), "data", "map-images");
}

const FILENAME_RE = /^\d+\.(png|jpg|webp)$/;

function filePath(filename: string): string {
  if (!FILENAME_RE.test(filename)) throw new Error(`invalid image filename: ${filename}`);
  return path.join(imageDir(), filename);
}

export async function writeImageFile(filename: string, bytes: Uint8Array): Promise<void> {
  const full = filePath(filename);
  await mkdir(imageDir(), { recursive: true });
  await writeFile(full, bytes);
}

export async function deleteImageFile(filename: string): Promise<void> {
  await rm(filePath(filename), { force: true });
}

export async function readImageFile(filename: string): Promise<Buffer | null> {
  if (!FILENAME_RE.test(filename)) return null;
  try {
    return await readFile(filePath(filename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

const json = (status: number, error: string) => Response.json({ error }, { status });
const MAX_NAME_LENGTH = 100;

/** POST /api/map-images: multipart `mapName`, `stage`, `file`. Creates or replaces the image for a stage the database has seen. */
export async function uploadMapImageResponse(db: Db, request: Request): Promise<Response> {
  try {
    const lengthHeader = request.headers.get("content-length");
    if (lengthHeader === null) return json(411, "content-length header required");
    const contentLength = Number(lengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) return json(400, "invalid content-length");
    if (contentLength > MAX_IMAGE_BYTES) return json(413, "image is larger than 10MB");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json(400, "expected multipart form data");
    }
    const mapName = String(form.get("mapName") ?? "").trim();
    const stageRaw = String(form.get("stage") ?? "");
    const file = form.get("file");
    if (!mapName) return json(400, "missing map name");
    if (mapName.length > MAX_NAME_LENGTH) return json(400, "map name too long");
    if (!/^\d{1,3}$/.test(stageRaw)) return json(400, "invalid stage");
    if (!(file instanceof File)) return json(400, "missing file");
    const stage = Number(stageRaw);

    const seen = await listStagesSeen(db);
    if (!seen.some((s) => s.mapName === mapName && s.stage === stage)) return json(404, "no map has played that stage yet");

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) return json(413, "image is larger than 10MB");
    const type = detectImageType(bytes, file.name);
    if (!type) return json(415, "use a PNG, JPEG, or WebP image");

    const { id, filename, replacedFilename } = await createMapImage(db, { mapName, stage, ext: type.ext, contentType: type.contentType }, (f) => writeImageFile(f, bytes));
    if (replacedFilename && replacedFilename !== filename) await deleteImageFile(replacedFilename);
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return json(500, "upload failed");
  }
}

/** GET /api/map-images/[id]: the stored file with its recorded content type. */
export async function mapImageResponse(db: Db, idParam: string): Promise<Response> {
  const id = parsePositiveInt(idParam);
  if (id === null) return json(400, "invalid id");
  const row = await getMapImage(db, id);
  if (!row) return json(404, "image not found");
  const bytes = await readImageFile(row.filename);
  if (!bytes) return json(404, "image file missing");
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Rows with a size and a parseable calibration, in the shape buildReplay attaches to stages. */
export function calibratedImages(rows: MapImageRow[]): CalibratedImage[] {
  const out: CalibratedImage[] = [];
  for (const row of rows) {
    if (!isCalibrated(row)) continue;
    const cal = parseCalibration(row.calibration)!;
    out.push({ stage: row.stage, id: row.id, width: row.width as number, height: row.height as number, affine: cal.affine });
  }
  return out;
}
