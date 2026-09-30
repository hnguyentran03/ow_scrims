"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { TEAM_COLORS } from "@/lib/colors";
import { formatDuration } from "@/lib/format";
import type { Sides } from "@/lib/stats/sides";
import { TEMPO_STEP_SECONDS, type Tempo, type TempoPoint } from "@/lib/stats/tempo";
import { Axes, H, innerH, Legend, linear, M, svgPoint, ticks, Tooltip, W } from "@/components/chart-utils";

type Variant = keyof Tempo["series"];
const VARIANTS: Array<{ key: Variant; label: string }> = [
  { key: "combined", label: "Combined" },
  { key: "kills", label: "Kills" },
  { key: "ults", label: "Ults" },
];
const SHOWN: Record<Variant, Array<"kill" | "ult">> = { combined: ["kill", "ult"], kills: ["kill"], ults: ["ult"] };

export function TempoChart({ tempo, sides }: { tempo: Tempo; sides: Sides }) {
  const [variant, setVariant] = useState<Variant>("combined");
  const [hover, setHover] = useState<{ x: number; y: number; point: TempoPoint } | null>(null);
  const points = tempo.series[variant];
  const tMax = Math.max(1, points.at(-1)?.t ?? 0);
  const peak = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  const x = linear(0, tMax, M.left, W - M.right);
  const y = linear(-peak, peak, H - M.bottom, M.top);
  const nearest = (t: number) => points.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const markers = tempo.markers.filter((m) => SHOWN[variant].includes(m.kind));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const { x: mx, y: my } = svgPoint(e);
    const t = ((mx - M.left) / (W - M.left - M.right)) * tMax;
    setHover({ x: mx, y: my, point: nearest(t) });
  }

  const fight = hover ? tempo.fights.find((f) => Math.floor(f.start) <= hover.point.t && hover.point.t <= Math.ceil(f.end)) : undefined;
  const inFight = hover && fight ? tempo.markers.filter((m) => m.kind === "kill" && m.t >= fight.start && m.t <= hover.point.t) : [];
  const ours = inFight.filter((m) => m.team === "ours").length;
  const theirs = inFight.filter((m) => m.team === "theirs").length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend sides={sides} />
        <div className="flex gap-2">
          {VARIANTS.map((v) => (
            <Button
              key={v.key}
              size="sm"
              variant={variant === v.key ? "primary" : "secondary"}
              onClick={() => setVariant(v.key)}
              aria-pressed={variant === v.key}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Tempo" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {tempo.fights.map((f) => (
          <rect
            key={f.index}
            x={x(f.start)}
            width={Math.max(1, x(f.end) - x(f.start))}
            y={M.top}
            height={innerH}
            fill={f.winner ? TEAM_COLORS[f.winner] : "var(--color-muted)"}
            opacity={0.12}
          />
        ))}
        <Axes yTicks={ticks(-peak, peak, 6)} yScale={y} yFormat={(v) => v.toFixed(1)} />
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} className="stroke-muted" />
        <path d={path} fill="none" className="stroke-ink" strokeWidth={2} />
        {markers.map((m, i) => (
          <circle
            key={i}
            cx={x(m.t)}
            cy={y(points[Math.min(points.length - 1, Math.max(0, Math.round(m.t / TEMPO_STEP_SECONDS)))].value)}
            r={m.kind === "ult" ? 4 : 3}
            fill={m.kind === "ult" ? "var(--color-raised)" : TEAM_COLORS[m.team]}
            stroke={TEAM_COLORS[m.team]}
            strokeWidth={m.kind === "ult" ? 2 : 0}
          />
        ))}
        {ticks(0, tMax, 6).map((t) => (
          <text key={t} x={x(t)} y={H - M.bottom + 14} textAnchor="middle" fontSize={10} className="fill-muted">{formatDuration(t)}</text>
        ))}
        {hover && (
          <>
            <line x1={x(hover.point.t)} x2={x(hover.point.t)} y1={M.top} y2={M.top + innerH} className="stroke-line" />
            <Tooltip
              x={hover.x}
              y={hover.y}
              lines={[
                `${formatDuration(hover.point.t)}, score ${hover.point.value.toFixed(1)}`,
                fight ? `Fight ${fight.index}, ${sides.ours} ${ours} – ${theirs} ${sides.theirs} so far` : "Between fights",
              ]}
            />
          </>
        )}
      </svg>
      <p className="text-xs text-muted">Filled dots are kills, rings are ultimate casts. Fight spans are shaded by winner.</p>
    </div>
  );
}
