"use client";

import { useState } from "react";
import { Axes, H, linear, M, svgPoint, ticks, Tooltip, W } from "@/components/chart-utils";
import { TEAM_COLORS } from "@/lib/colors";
import { formatInt } from "@/lib/format";
import { CHART_STAT_KEYS, CHART_STATS, type ChartPoint, type ChartStat } from "@/lib/stats/player";

const fmt = (v: number) => (v >= 100 ? formatInt(v) : v.toFixed(1));

/** One line, one point per scrim, of the chosen stat per 10 minutes. */
export function StatChart({ points }: { points: ChartPoint[] }) {
  const [stat, setStat] = useState<ChartStat>("eliminations");
  const [hover, setHover] = useState<{ x: number; y: number; point: ChartPoint } | null>(null);
  const value = (p: ChartPoint) => p.per10[stat];
  const max = Math.max(1, ...points.map(value));
  const x = linear(0, Math.max(1, points.length - 1), M.left, W - M.right);
  const y = linear(0, max, H - M.bottom, M.top);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(value(p)).toFixed(1)}`).join(" ");

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const { x: mx, y: my } = svgPoint(e);
    const i = points.reduce((best, _, idx) => (Math.abs(x(idx) - mx) < Math.abs(x(best) - mx) ? idx : best), 0);
    setHover({ x: mx, y: my, point: points[i] });
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        Stat per 10 minutes
        <select value={stat} onChange={(e) => setStat(e.target.value as ChartStat)} className="rounded bg-zinc-900 px-2 py-1">
          {CHART_STAT_KEYS.map((k) => (
            <option key={k} value={k}>{CHART_STATS[k]}</option>
          ))}
        </select>
      </label>
      {points.length <= 1 ? (
        <p className="text-sm text-zinc-500">Need at least two scrims in range to draw a trend.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${CHART_STATS[stat]} per 10 minutes by scrim`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <Axes yTicks={ticks(0, max, 5)} yScale={y} yFormat={fmt} />
          <path d={path} fill="none" stroke={TEAM_COLORS.ours} strokeWidth={2} />
          {points.map((p, i) => (
            <g key={p.scrimId}>
              <circle cx={x(i)} cy={y(value(p))} r={4} fill={TEAM_COLORS.ours} />
              <text x={x(i)} y={H - M.bottom + 14} textAnchor="middle" fontSize={10} fill="#a1a1aa">{p.date.slice(5)}</text>
            </g>
          ))}
          {hover && (
            <Tooltip x={hover.x} y={hover.y} lines={[`${hover.point.name} · ${hover.point.date}`, `${CHART_STATS[stat]}: ${fmt(value(hover.point))} per 10`, `${hover.point.maps} map${hover.point.maps === 1 ? "" : "s"}`]} />
          )}
        </svg>
      )}
    </div>
  );
}
