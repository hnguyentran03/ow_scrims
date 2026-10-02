export const MIN_FIT_POINTS = 3;

export interface Fit {
  slope: number;
  intercept: number;
  /** Pearson's r; 0 when every y is equal. */
  r: number;
  n: number;
}

/** Ordinary least squares of y on x. Null with fewer than MIN_FIT_POINTS points or when every x is equal. */
export function linearFit(points: ReadonlyArray<{ x: number; y: number }>): Fit | null {
  const n = points.length;
  if (n < MIN_FIT_POINTS) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  return { slope, intercept: my - slope * mx, r, n };
}
