import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function logDir(): string {
  return process.env.LOG_DIR ?? path.join(process.cwd(), "data", "logs");
}

/** Writes the raw log for a map to <LOG_DIR>/<mapId>.txt and returns the path relative to cwd. */
export async function writeRawLog(mapId: number, bytes: Buffer): Promise<string> {
  const dir = logDir();
  await mkdir(dir, { recursive: true });
  const full = path.join(dir, `${mapId}.txt`);
  await writeFile(full, bytes);
  return path.relative(process.cwd(), full);
}

export async function deleteRawLog(relPath: string | null): Promise<void> {
  if (!relPath) return;
  await rm(path.resolve(process.cwd(), relPath), { force: true });
}
