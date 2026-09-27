"use client";

import { useState } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import { heroAbbrev } from "@/lib/hero-abbrev";
import { applyAffine, PLANE_SIZE, type Affine } from "@/lib/stats/calibration";
import { heroAt, positionAt } from "@/lib/stats/playback";
import type { Replay, ReplayStage } from "@/lib/stats/replay";
import { windowIndexAt } from "@/lib/stats/stages";
import { DEATH_MARKER_SECONDS } from "@/lib/stats/tracks";

const NEUTRAL = "#71717a";

/** Everything the canvas needs to place a world point on the current stage. */
export function stageFrame(stage: ReplayStage): { width: number; height: number; affine: Affine; size: number } {
  const width = stage.image?.width ?? PLANE_SIZE;
  const height = stage.image?.height ?? PLANE_SIZE;
  return { width, height, affine: stage.image?.affine ?? stage.bounds, size: Math.max(width, height) };
}

export function ReplayCanvas({ replay, t, windowIndex, mapName, children }: { replay: Replay; t: number; windowIndex: number; mapName: string; children?: React.ReactNode }) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const stage = replay.stages[windowIndex];
  const { width, height, affine, size } = stageFrame(stage);
  const r = size * 0.012;
  const project = (p: { x: number; z: number }) => applyAffine(affine, p);
  const colour = (side: "ours" | "theirs" | null) => (side ? TEAM_COLORS[side] : NEUTRAL);
  const gridStep = PLANE_SIZE / 10;

  const markers = replay.players.flatMap((p) => {
    const pos = positionAt(p.segments, t);
    if (!pos || pos.window !== windowIndex) return [];
    const { px, py } = project(pos);
    return [{ key: `${p.team}|${p.name}`, px, py, colour: colour(p.side), hero: heroAt(replay.heroes, p.team, p.name, t), name: p.name }];
  });
  const deaths = replay.deaths.filter(
    (d) => d.x !== null && d.t <= t && t < d.t + DEATH_MARKER_SECONDS && windowIndexAt(d.t, replay.stages) === windowIndex,
  );
  const hover = hoverKey ? markers.find((m) => m.key === hoverKey) ?? null : null;

  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded border border-zinc-800 bg-zinc-950" role="img" aria-label={`Replay of ${mapName}, ${stage.label}`} onMouseLeave={() => setHoverKey(null)}>
        {stage.image ? (
          <image href={`/api/map-images/${stage.image.id}`} width={width} height={height} />
        ) : (
          <g stroke="#27272a">
            {Array.from({ length: 11 }, (_, i) => i * gridStep).map((v) => (
              <g key={v}>
                <line x1={v} x2={v} y1={0} y2={PLANE_SIZE} />
                <line x1={0} x2={PLANE_SIZE} y1={v} y2={v} />
              </g>
            ))}
          </g>
        )}
        {deaths.map((d) => {
          const { px, py } = project({ x: d.x!, z: d.z! });
          const side = replay.players.find((p) => p.team === d.team && p.name === d.name)?.side ?? null;
          const fade = 1 - (t - d.t) / DEATH_MARKER_SECONDS;
          return (
            <g key={`${d.team}|${d.name}|${d.t}`} stroke={colour(side)} strokeWidth={r * 0.35} opacity={0.3 + 0.7 * fade}>
              <line x1={px - r} y1={py - r} x2={px + r} y2={py + r} />
              <line x1={px - r} y1={py + r} x2={px + r} y2={py - r} />
            </g>
          );
        })}
        {markers.map((m) => (
          <g key={m.key} onMouseEnter={() => setHoverKey(m.key)} onMouseLeave={() => setHoverKey(null)}>
            <circle cx={m.px} cy={m.py} r={r} fill={m.colour} stroke="#09090b" strokeWidth={r * 0.15} />
            <text x={m.px} y={m.py} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1} fontWeight={600} fill="#fafafa" pointerEvents="none">
              {heroAbbrev(m.hero)}
            </text>
          </g>
        ))}
        {children}
        {hover && (
          <g transform={`translate(${Math.min(hover.px + r, width - size * 0.25)},${Math.max(hover.py - r * 3, r)})`} pointerEvents="none">
            <rect width={size * 0.25} height={r * 2.2} rx={r * 0.3} fill="#18181b" stroke="#3f3f46" />
            <text x={r * 0.6} y={r * 1.45} fontSize={r} fill="#e4e4e7">{hover.name} · {hover.hero || "?"}</text>
          </g>
        )}
      </svg>
      {!stage.image && <p className="text-xs text-zinc-500">No calibrated image for {stage.label} yet. Positions are drawn on a plane fitted to this round.</p>}
    </div>
  );
}
