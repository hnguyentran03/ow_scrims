import type { Pair } from "./stats/calibration";

export const MAX_PAIRS = 50;
export const MAX_IMAGE_SIDE = 16384;

export interface CalibrationInput {
  id: number;
  pairs: Pair[];
  width: number;
  height: number;
  objective: { px: number; py: number } | null;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const side = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_IMAGE_SIDE;

/** The payload of setCalibrationAction, or null when any field is off. Everything here comes from the browser. */
export function parseCalibrationInput(raw: unknown): CalibrationInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Number.isInteger(o.id) || (o.id as number) <= 0) return null;
  if (!side(o.width) || !side(o.height)) return null;
  if (!Array.isArray(o.pairs) || o.pairs.length < 3 || o.pairs.length > MAX_PAIRS) return null;
  const pairs: Pair[] = [];
  for (const p of o.pairs as Array<Record<string, Record<string, unknown>>>) {
    const w = p?.world;
    const i = p?.image;
    if (!w || !i || !num(w.x) || !num(w.z) || !num(i.px) || !num(i.py)) return null;
    pairs.push({ world: { x: w.x, z: w.z }, image: { px: i.px, py: i.py } });
  }
  let objective: CalibrationInput["objective"] = null;
  if (o.objective !== null && o.objective !== undefined) {
    const ob = o.objective as Record<string, unknown>;
    if (!num(ob.px) || !num(ob.py)) return null;
    objective = { px: ob.px, py: ob.py };
  }
  return { id: o.id as number, pairs, width: o.width as number, height: o.height as number, objective };
}
