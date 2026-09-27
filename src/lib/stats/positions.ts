import { POSITION_RE } from "@/lib/parser/coerce";

/** A Workshop position. `y` is height; the ground plane is (x, z). */
export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface GroundPoint {
  x: number;
  z: number;
}

/** The stored `(x, y, z)` text as numbers, or null for anything the parser would also have rejected. */
export function parsePosition(raw: string | null | undefined): Point | null {
  if (typeof raw !== "string" || !POSITION_RE.test(raw)) return null;
  const inner = raw.slice(raw.indexOf("(") + 1, raw.lastIndexOf(")"));
  const [x, y, z] = inner.split(",").map((s) => Number(s.trim()));
  return { x, y, z };
}

export function groundPoint(p: Point): GroundPoint {
  return { x: p.x, z: p.z };
}
