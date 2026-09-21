const FILENAME_TIME = /(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/;

/** Epoch ms from a Workshop filename (Log-YYYY-MM-DD-HH-MM-SS), else the file's modification time. */
export function uploadTime(file: { name: string; lastModified: number }): number {
  const m = FILENAME_TIME.exec(file.name);
  if (!m) return file.lastModified;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

/** Play order for a batch: filename timestamp, then modification time, then name. */
export function orderUploads<T extends { name: string; lastModified: number }>(files: T[]): T[] {
  return [...files].sort((a, b) => uploadTime(a) - uploadTime(b) || a.name.localeCompare(b.name));
}
