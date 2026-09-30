"use client";

import { formatPer10 } from "@/lib/format";
import type { RadarAxis } from "@/lib/stats/telemetry";

const SIZE = 320;
const C = SIZE / 2;
const R = 110;

export function Radar({ axes, playerLabel, opponentLabel, playerColor, opponentColor }: {
  axes: RadarAxis[];
  playerLabel: string;
  opponentLabel: string | null;
  playerColor: string;
  opponentColor: string;
}) {
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const point = (i: number, v: number) => ({ x: C + R * v * Math.cos(angle(i)), y: C + R * v * Math.sin(angle(i)) });
  const ring = (v: number) => axes.map((_, i) => { const p = point(i, v); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");
  const polygon = (pick: (a: RadarAxis) => number) =>
    axes.map((a, i) => { const p = point(i, pick(a) / a.max); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: playerColor }} />{playerLabel}</span>
        {opponentLabel && <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: opponentColor }} />{opponentLabel}</span>}
      </div>
      <svg viewBox={`-60 -10 ${SIZE + 120} ${SIZE + 20}`} className="mx-auto w-full max-w-sm" role="img" aria-label="Matchup radar">
        {[0.25, 0.5, 0.75, 1].map((v) => <polygon key={v} points={ring(v)} fill="none" className="stroke-line" />)}
        {axes.map((_, i) => { const p = point(i, 1); return <line key={i} x1={C} y1={C} x2={p.x} y2={p.y} className="stroke-line" />; })}
        {opponentLabel && <polygon points={polygon((a) => a.opponent)} fill={opponentColor} fillOpacity={0.2} stroke={opponentColor} strokeWidth={2} />}
        <polygon points={polygon((a) => a.player)} fill={playerColor} fillOpacity={0.25} stroke={playerColor} strokeWidth={2} />
        {axes.map((a, i) => {
          const p = point(i, 1.22);
          return (
            <text key={a.label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={10} className="fill-muted">
              {a.label}: {formatPer10(a.player)}{opponentLabel ? ` / ${formatPer10(a.opponent)}` : ""}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
