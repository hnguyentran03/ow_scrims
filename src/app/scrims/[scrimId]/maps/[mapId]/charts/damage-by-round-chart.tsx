"use client";

import { useState } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import { formatInt } from "@/lib/format";
import type { RoundPoint } from "@/lib/stats/charts";
import type { Sides } from "@/lib/stats/sides";
import { Axes, H, Legend, linear, M, svgPoint, ticks, Tooltip, W } from "./chart-utils";

export function DamageByRoundChart({ points, sides }: { points: RoundPoint[]; sides: Sides }) {
  const [hover, setHover] = useState<{ x: number; y: number; point: RoundPoint } | null>(null);
  const max = Math.max(1, ...points.flatMap((p) => [p.ours, p.theirs]));
  const x = linear(0, Math.max(1, points.length - 1), M.left, W - M.right);
  const y = linear(0, max, H - M.bottom, M.top);
  const area = (key: "ours" | "theirs") => {
    if (points.length === 0) return "";
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    return `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  };

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const { x: mx, y: my } = svgPoint(e);
    const i = points.reduce((best, _, idx) => (Math.abs(x(idx) - mx) < Math.abs(x(best) - mx) ? idx : best), 0);
    setHover({ x: mx, y: my, point: points[i] });
  }

  return (
    <div className="space-y-2">
      <Legend sides={sides} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative hero damage by round" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <Axes yTicks={ticks(0, max, 5)} yScale={y} yFormat={formatInt} />
        <path d={area("theirs")} fill={`${TEAM_COLORS.theirs}33`} stroke={TEAM_COLORS.theirs} strokeWidth={2} />
        <path d={area("ours")} fill={`${TEAM_COLORS.ours}33`} stroke={TEAM_COLORS.ours} strokeWidth={2} />
        {points.map((p, i) => (
          <g key={p.roundNumber}>
            <circle cx={x(i)} cy={y(p.ours)} r={4} fill={TEAM_COLORS.ours} />
            <circle cx={x(i)} cy={y(p.theirs)} r={4} fill={TEAM_COLORS.theirs} />
            <text x={x(i)} y={H - M.bottom + 14} textAnchor="middle" fontSize={10} fill="#a1a1aa">Round {p.roundNumber}</text>
          </g>
        ))}
        {hover && <Tooltip x={hover.x} y={hover.y} lines={[`Round ${hover.point.roundNumber}`, `${sides.ours}: ${formatInt(hover.point.ours)}`, `${sides.theirs}: ${formatInt(hover.point.theirs)}`]} />}
      </svg>
    </div>
  );
}
