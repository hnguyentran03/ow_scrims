"use client";

import { useState } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import { formatDuration } from "@/lib/format";
import type { StepPoint } from "@/lib/stats/charts";
import type { Sides } from "@/lib/stats/sides";
import { Axes, H, innerH, Legend, linear, M, svgPoint, ticks, Tooltip, W } from "./chart-utils";

export function KillsByFightChart({ points, sides }: { points: StepPoint[]; sides: Sides }) {
  const [hover, setHover] = useState<{ x: number; y: number; point: StepPoint } | null>(null);
  const maxOurs = Math.max(1, ...points.map((p) => p.ours));
  const maxTheirs = Math.max(1, ...points.map((p) => p.theirs));
  const tMax = Math.max(1, ...points.map((p) => p.time));
  const x = linear(0, tMax, M.left, W - M.right);
  const y = linear(-maxTheirs, maxOurs, H - M.bottom, M.top);
  const path = (sign: 1 | -1, key: "ours" | "theirs") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.time).toFixed(1)},${y(sign * p[key]).toFixed(1)}`).join(" ");
  const yTicks = ticks(-maxTheirs, maxOurs, 6);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const { x: mx, y: my } = svgPoint(e);
    const fights = points.filter((p) => p.fightIndex !== null);
    if (fights.length === 0) return;
    const nearest = fights.reduce((best, p) => (Math.abs(x(p.time) - mx) < Math.abs(x(best.time) - mx) ? p : best));
    setHover({ x: mx, y: my, point: nearest });
  }

  return (
    <div className="space-y-2">
      <Legend sides={sides} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Kills by fight" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <Axes yTicks={yTicks} yScale={y} yFormat={(v) => String(Math.abs(v))} />
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#71717a" />
        <path d={path(1, "ours")} fill="none" stroke={TEAM_COLORS.ours} strokeWidth={2} />
        <path d={path(-1, "theirs")} fill="none" stroke={TEAM_COLORS.theirs} strokeWidth={2} />
        {ticks(0, tMax, 6).map((t) => (
          <text key={t} x={x(t)} y={H - M.bottom + 14} textAnchor="middle" fontSize={10} fill="#a1a1aa">{formatDuration(t)}</text>
        ))}
        {hover && (
          <>
            <line x1={x(hover.point.time)} x2={x(hover.point.time)} y1={M.top} y2={M.top + innerH} stroke="#52525b" />
            <Tooltip
              x={hover.x}
              y={hover.y}
              lines={[
                `Fight ${hover.point.fightIndex} · ${formatDuration(hover.point.start)}–${formatDuration(hover.point.end)}`,
                `${sides.ours}: ${hover.point.ours}`,
                `${sides.theirs}: ${hover.point.theirs}`,
              ]}
            />
          </>
        )}
      </svg>
    </div>
  );
}
