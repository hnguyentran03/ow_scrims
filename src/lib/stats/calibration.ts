/** Ground plane (x, z) → image pixels: px = a·x + b·z + c, py = d·x + e·z + f. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** One clicked correspondence between a world position and a pixel on the map image. */
export interface Pair {
  world: { x: number; z: number };
  image: { px: number; py: number };
}

/** Side of the square viewBox used when no image is calibrated. */
export const PLANE_SIZE = 1000;

export function applyAffine(m: Affine, p: { x: number; z: number }): { px: number; py: number } {
  return { px: m.a * p.x + m.b * p.z + m.c, py: m.d * p.x + m.e * p.z + m.f };
}

/** The inverse transform (pixels → world), or null when the linear part is singular. */
export function invertAffine(m: Affine): Affine | null {
  const det = m.a * m.e - m.b * m.d;
  if (Math.abs(det) < 1e-12) return null;
  const a = m.e / det;
  const b = -m.b / det;
  const d = -m.d / det;
  const e = m.a / det;
  return { a, b, c: -(a * m.c + b * m.f), d, e, f: -(d * m.c + e * m.f) };
}

/**
 * The blank-plane fallback: the points' bounding box, padded by `padding` of its longer side on every edge,
 * fills a PLANE_SIZE square with the aspect preserved and z increasing upwards (image y decreasing).
 */
export function fitBounds(points: Array<{ x: number; z: number }>, padding = 0.1): Affine {
  const half = PLANE_SIZE / 2;
  if (points.length === 0) return { a: 1, b: 0, c: half, d: 0, e: -1, f: half };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const scale = PLANE_SIZE / (span * (1 + 2 * padding));
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  return { a: scale, b: 0, c: half - scale * cx, d: 0, e: -scale, f: half + scale * cz };
}

/** Cramer's rule for a 3×3 system; null when singular. */
function solve3(m: number[][], rhs: number[]): [number, number, number] | null {
  const det = (a: number[][]) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  if (Math.abs(d) < 1e-9) return null;
  const col = (i: number) => m.map((row, r) => row.map((v, c) => (c === i ? rhs[r] : v)));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

/** True when every world point lies on one line (within a small area tolerance), which makes the fit singular. */
function collinear(points: Array<{ x: number; z: number }>): boolean {
  const p0 = points[0];
  // Find the first point separated from p0 by distance > sqrt(1e-18) ≈ 1e-9
  let ref: { x: number; z: number } | null = null;
  for (const p of points) {
    const dx = p.x - p0.x;
    const dz = p.z - p0.z;
    if (dx * dx + dz * dz > 1e-18) {
      ref = p;
      break;
    }
  }
  // If no separated point found, all points coincide (collinear)
  if (!ref) return true;
  // Test all points against the (p0, ref) direction
  return points.every((p) => Math.abs((ref!.x - p0.x) * (p.z - p0.z) - (ref!.z - p0.z) * (p.x - p0.x)) < 1e-6);
}

/**
 * Least-squares affine from three or more (world, image) pairs. The six unknowns split into two independent
 * 3×3 normal-equation systems, one for px = a·x + b·z + c and one for py = d·x + e·z + f.
 */
export function solveAffine(pairs: Pair[]): Affine | null {
  if (pairs.length < 3 || collinear(pairs.map((p) => p.world))) return null;
  let sxx = 0, sxz = 0, sx = 0, szz = 0, sz = 0;
  const rx = [0, 0, 0];
  const ry = [0, 0, 0];
  for (const { world: w, image: i } of pairs) {
    sxx += w.x * w.x; sxz += w.x * w.z; sx += w.x; szz += w.z * w.z; sz += w.z;
    rx[0] += w.x * i.px; rx[1] += w.z * i.px; rx[2] += i.px;
    ry[0] += w.x * i.py; ry[1] += w.z * i.py; ry[2] += i.py;
  }
  const normal = [[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, pairs.length]];
  const abc = solve3(normal, rx);
  const def = solve3(normal, ry);
  if (!abc || !def) return null;
  return { a: abc[0], b: abc[1], c: abc[2], d: def[0], e: def[1], f: def[2] };
}

export interface Calibration {
  pairs: Pair[];
  affine: Affine;
  objective: { x: number; z: number } | null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isPair = (p: unknown): p is Pair => {
  const o = p as Pair;
  return !!o && !!o.world && !!o.image && isNum(o.world.x) && isNum(o.world.z) && isNum(o.image.px) && isNum(o.image.py);
};
const isAffine = (a: unknown): a is Affine => {
  const o = a as Affine;
  return !!o && (["a", "b", "c", "d", "e", "f"] as const).every((k) => isNum(o[k]));
};

/** The JSON stored on map_image.calibration, or null when absent or malformed. */
export function parseCalibration(raw: string | null): Calibration | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const o = parsed as Calibration;
  if (!o || !Array.isArray(o.pairs) || !o.pairs.every(isPair) || !isAffine(o.affine)) return null;
  const objective = o.objective === null || o.objective === undefined ? null : isNum(o.objective.x) && isNum(o.objective.z) ? { x: o.objective.x, z: o.objective.z } : null;
  return { pairs: o.pairs.map((p) => ({ world: { x: p.world.x, z: p.world.z }, image: { px: p.image.px, py: p.image.py } })), affine: { a: o.affine.a, b: o.affine.b, c: o.affine.c, d: o.affine.d, e: o.affine.e, f: o.affine.f }, objective };
}
