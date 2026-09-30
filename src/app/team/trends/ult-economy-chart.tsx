"use client";

import { useState } from "react";
import { Axes, H, linear, M, svgPoint, ticks, Tooltip, W } from "@/components/chart-utils";
import { TEAM_COLORS } from "@/lib/colors";
import { formatSeconds } from "@/lib/format";
import type { UltEconomyPoint } from "@/lib/stats/trends";

interface Series {
  label: string;
  value: (p: UltEconomyPoint) => number | null;
  format: (v: number) => string;
}

export type EconomyKind = "per10" | "timing";

const seconds = (v: number) => formatSeconds(v);
const oneDecimal = (v: number) => v.toFixed(1);

const SERIES: Record<EconomyKind, { title: string; series: [Series, Series] }> = {
  per10: {
    title: "Ults earned and used per 10 minutes",
    series: [
      { label: "Earned", value: (p) => p.earnedPer10, format: oneDecimal },
      { label: "Used", value: (p) => p.usedPer10, format: oneDecimal },
    ],
  },
  timing: {
    title: "Average ult charge and hold time",
    series: [
      { label: "Charge", value: (p) => p.avgChargeSeconds, format: seconds },
      { label: "Hold", value: (p) => p.avgHoldSeconds, format: seconds },
    ],
  },
};

export function UltEconomyChart({ points, kind }: { points: UltEconomyPoint[]; kind: EconomyKind }) {
  const { title, series } = SERIES[kind];
  const [hover, setHover] = useState<{ x: number; y: number; point: UltEconomyPoint } | null>(null);
  const values = points.flatMap((p) => series.map((s) => s.value(p))).filter((v): v is number => v !== null);
  const max = Math.max(1, ...values);
  const x = points.length <= 1 ? () => (M.left + W - M.right) / 2 : linear(0, points.length - 1, M.left, W - M.right);
  const y = linear(0, max, H - M.bottom, M.top);
  const path = (s: Series) =>
    points
      .map((p, i) => [i, s.value(p)] as const)
      .filter((d): d is readonly [number, number] => d[1] !== null)
      .map(([i, v], k) => `${k === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const { x: mx, y: my } = svgPoint(e);
    const i = points.reduce((best, _, idx) => (Math.abs(x(idx) - mx) < Math.abs(x(best) - mx) ? idx : best), 0);
    setHover({ x: mx, y: my, point: points[i] });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: TEAM_COLORS.ours }} />{series[0].label}</span>
        <span><span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed align-middle" style={{ borderColor: TEAM_COLORS.ours }} />{series[1].label}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <Axes yTicks={ticks(0, max, 5)} yScale={y} yFormat={series[0].format} />
        <path d={path(series[0])} fill="none" stroke={TEAM_COLORS.ours} strokeWidth={2} />
        <path d={path(series[1])} fill="none" stroke={TEAM_COLORS.ours} strokeWidth={2} strokeDasharray="6 4" />
        {points.map((p, i) => (
          <g key={p.scrimId}>
            {series.map((s, k) => {
              const v = s.value(p);
              return v === null ? null : <circle key={k} cx={x(i)} cy={y(v)} r={4} fill={k === 0 ? TEAM_COLORS.ours : "var(--color-raised)"} stroke={TEAM_COLORS.ours} strokeWidth={2} />;
            })}
            <text x={x(i)} y={H - M.bottom + 14} textAnchor="middle" fontSize={10} className="fill-muted">{p.date.slice(5)}</text>
          </g>
        ))}
        {hover && (
          <Tooltip x={hover.x} y={hover.y} lines={[`${hover.point.name}, ${hover.point.date}`, ...series.map((s) => { const v = s.value(hover.point); return `${s.label}: ${v === null ? "–" : s.format(v)}`; })]} />
        )}
      </svg>
    </div>
  );
}
