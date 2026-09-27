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
