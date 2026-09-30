"use client";

import type { MouseEvent } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import type { Sides } from "@/lib/stats/sides";

export const W = 640;
export const H = 280;
export const M = { top: 16, right: 16, bottom: 28, left: 52 };
export const innerW = W - M.left - M.right;
export const innerH = H - M.top - M.bottom;

/** Linear scale from [d0, d1] to [r0, r1]; a zero-width domain maps to r0. */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0;
  return (v) => (span === 0 ? r0 : r0 + ((v - d0) / span) * (r1 - r0));
}

/** Roughly `n` round-number ticks covering [min, max]. */
export function ticks(min: number, max: number, n: number): number[] {
  if (max <= min) return [min];
  const raw = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** Mouse position in viewBox units. */
export function svgPoint(e: MouseEvent<SVGSVGElement>): { x: number; y: number } {
  const rect = e.currentTarget.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
}

export function Axes({ yTicks, yScale, yFormat = String }: { yTicks: number[]; yScale: (v: number) => number; yFormat?: (v: number) => string }) {
  return (
    <g>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={yScale(t)} y2={yScale(t)} className="stroke-line" />
          <text x={M.left - 6} y={yScale(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} className="fill-muted">{yFormat(t)}</text>
        </g>
      ))}
      <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} className="stroke-line" />
      <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} className="stroke-line" />
    </g>
  );
}

export function Tooltip({ x, y, lines }: { x: number; y: number; lines: string[] }) {
  const width = Math.max(...lines.map((l) => l.length)) * 6.2 + 16;
  const height = lines.length * 14 + 10;
  const left = Math.min(Math.max(x + 10, M.left), W - M.right - width);
  const top = Math.min(Math.max(y - height - 6, M.top), H - M.bottom - height);
  return (
    <g transform={`translate(${left},${top})`} pointerEvents="none">
      <rect width={width} height={height} rx={4} className="fill-raised stroke-line" />
      {lines.map((l, i) => (
        <text key={i} x={8} y={14 + i * 14} fontSize={10} className="fill-ink">{l}</text>
      ))}
    </g>
  );
}

export function Legend({ sides }: { sides: Sides }) {
  return (
    <div className="flex gap-4 text-xs text-muted">
      <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: TEAM_COLORS.ours }} />{sides.ours}</span>
      <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: TEAM_COLORS.theirs }} />{sides.theirs}</span>
    </div>
  );
}
