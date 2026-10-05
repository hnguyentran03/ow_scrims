import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function defaultLogDir(): string {
  return process.env.LOG_DIR ?? path.join(process.cwd(), "data", "logs");
}

/**
 * Writes the raw log for a map to <dir>/<mapId>.txt. Returns a cwd-relative path
 * when the directory is inside the working directory (the local layout) and an
 * absolute one otherwise (sandbox upload roots live under /var/lib).
 */
export async function writeRawLog(mapId: number, bytes: Buffer, dir: string = defaultLogDir()): Promise<string> {
  await mkdir(dir, { recursive: true });
  const full = path.join(dir, `${mapId}.txt`);
  await writeFile(full, bytes);
  const rel = path.relative(process.cwd(), full);
  return rel.startsWith("..") || path.isAbsolute(rel) ? full : rel;
}

/** Accepts either form writeRawLog returns; resolve is a no-op for an absolute path. */
export async function deleteRawLog(stored: string | null): Promise<void> {
  if (!stored) return;
  await rm(path.resolve(process.cwd(), stored), { force: true });
}
