"use client";

import { useState } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import type { RoleBars } from "@/lib/stats/charts";
import type { Sides } from "@/lib/stats/sides";
import { Axes, H, innerW, Legend, linear, M, svgPoint, ticks, Tooltip, W } from "./chart-utils";

export function FinalBlowsByRoleChart({ bars, sides }: { bars: RoleBars[]; sides: Sides }) {
  const [hover, setHover] = useState<{ x: number; y: number; bar: RoleBars } | null>(null);
  const max = Math.max(1, ...bars.flatMap((b) => [b.ours, b.theirs]));
  const y = linear(0, max, H - M.bottom, M.top);
  const group = innerW / Math.max(1, bars.length);
  const barW = group * 0.3;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const { x, y: my } = svgPoint(e);
    const i = Math.min(bars.length - 1, Math.max(0, Math.floor((x - M.left) / group)));
    if (bars[i]) setHover({ x, y: my, bar: bars[i] });
  }

  return (
    <div className="space-y-2">
      <Legend sides={sides} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Final blows by role" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <Axes yTicks={ticks(0, max, 5)} yScale={y} />
        {bars.map((b, i) => {
          const cx = M.left + group * i + group / 2;
          return (
            <g key={b.role}>
              <rect x={cx - barW - 2} y={y(b.ours)} width={barW} height={y(0) - y(b.ours)} fill={TEAM_COLORS.ours} />
              <rect x={cx + 2} y={y(b.theirs)} width={barW} height={y(0) - y(b.theirs)} fill={TEAM_COLORS.theirs} />
              <text x={cx} y={H - M.bottom + 14} textAnchor="middle" fontSize={10} fill="#a1a1aa">{b.role}</text>
            </g>
          );
        })}
        {hover && <Tooltip x={hover.x} y={hover.y} lines={[hover.bar.role, `${sides.ours}: ${hover.bar.ours}`, `${sides.theirs}: ${hover.bar.theirs}`]} />}
      </svg>
    </div>
  );
}
