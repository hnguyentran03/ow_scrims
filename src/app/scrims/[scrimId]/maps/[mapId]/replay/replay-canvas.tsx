"use client";

import { useState } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import { heroAbbrev } from "@/lib/hero-abbrev";
import { applyAffine, PLANE_SIZE, type Affine } from "@/lib/stats/calibration";
import { activeKillLines, activeUltRings, heroAt, positionAt, ultPulse } from "@/lib/stats/playback";
import { KILL_LINE_SECONDS, type Replay, type ReplayStage } from "@/lib/stats/replay";
import { windowIndexAt } from "@/lib/stats/stages";
import { DEATH_MARKER_SECONDS } from "@/lib/stats/tracks";
import { StageCanvas } from "../stage-canvas";

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
  const { width, affine, size } = stageFrame(stage);
  const r = size * 0.012;
  const project = (p: { x: number; z: number }) => applyAffine(affine, p);
  const colour = (side: "ours" | "theirs" | null) => (side ? TEAM_COLORS[side] : NEUTRAL);

  const markers = replay.players.flatMap((p) => {
    const pos = positionAt(p.segments, t);
    if (!pos || pos.window !== windowIndex) return [];
    const { px, py } = project(pos);
    return [{ key: `${p.team}|${p.name}`, px, py, colour: colour(p.side), hero: heroAt(replay.heroes, p.team, p.name, t), name: p.name }];
  });
  const deaths = replay.deaths.filter(
    (d) => d.x !== null && d.t <= t && t < d.t + DEATH_MARKER_SECONDS && windowIndexAt(d.t, replay.stages) === windowIndex,
  );
  // A kill belongs to the window its time falls in, never to a segment.
  const lines = activeKillLines(replay.kills, t).filter((k) => windowIndexAt(k.t, replay.stages) === windowIndex);
  const rings = activeUltRings(replay.ults, t);
  const hover = hoverKey ? markers.find((m) => m.key === hoverKey) ?? null : null;

  return (
    <div className="space-y-1">
      <StageCanvas stage={stage} className="w-full rounded border border-zinc-800 bg-zinc-950" aria-label={`Replay of ${mapName}, ${stage.label}`} onMouseLeave={() => setHoverKey(null)}>
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
        {lines.map((k) => {
          // activeKillLines only returns kills where the attacker and both positions are non-null.
          const a = project({ x: k.attacker!.x!, z: k.attacker!.z! });
          const v = project({ x: k.victim.x!, z: k.victim.z! });
          const side = replay.players.find((p) => p.team === k.attacker!.team && p.name === k.attacker!.name)?.side ?? null;
          return <line key={`${k.t}|${k.victim.name}`} x1={a.px} y1={a.py} x2={v.px} y2={v.py} stroke={colour(side)} strokeWidth={r * 0.25} opacity={1 - (t - k.t) / KILL_LINE_SECONDS} />;
        })}
        {rings.map((u) => {
          const player = replay.players.find((p) => p.team === u.team && p.name === u.name);
          const pos = player ? positionAt(player.segments, t) : null;
          const pulse = ultPulse(u, t);
          // ultPulse returns non-null only when the ult has a cast position, so u.x/u.z are safe here.
          const cast = pulse !== null ? project({ x: u.x!, z: u.z! }) : null;
          return (
            <g key={`${u.start}|${u.name}`} fill="none" stroke={colour(player?.side ?? null)}>
              {pos && pos.window === windowIndex && <circle cx={project(pos).px} cy={project(pos).py} r={r * 1.8} strokeWidth={r * 0.25} strokeDasharray={`${r * 0.6} ${r * 0.4}`} />}
              {pulse !== null && cast && windowIndexAt(u.start, replay.stages) === windowIndex && (
                <circle cx={cast.px} cy={cast.py} r={r * (1 + 3 * pulse)} strokeWidth={r * 0.3} opacity={1 - pulse} />
              )}
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
      </StageCanvas>
      {!stage.image && <p className="text-xs text-zinc-500">No calibrated image for {stage.label} yet. Positions are drawn on a plane fitted to this round.</p>}
    </div>
  );
}
