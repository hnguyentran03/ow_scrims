"use client";

import type { SVGProps } from "react";
import { PLANE_SIZE } from "@/lib/stats/calibration";
import type { Replay } from "@/lib/stats/replay";

type Stage = Replay["stages"][number];

export const NO_POSITIONS = "Position logging was off for this map. Turn on position logging in the ScrimTime Workshop settings before hosting.";

export function stageSize(stage: Stage): { w: number; h: number } {
  return { w: stage.image?.width ?? PLANE_SIZE, h: stage.image?.height ?? PLANE_SIZE };
}

/** Marker radius as a fraction of the viewBox so calibrated images and the blank plane look alike. */
export function markerRadius(stage: Stage): number {
  const { w, h } = stageSize(stage);
  return Math.max(w, h) / 120;
}

const GRID_LINES = 10;

/** The stage as an SVG: the calibrated image when there is one, else a faint grid on the fitted blank plane. Overlays go in `children`. */
export function StageCanvas({ stage, children, className = "w-full", ...rest }: { stage: Stage; children?: React.ReactNode; className?: string } & Omit<SVGProps<SVGSVGElement>, "viewBox" | "children">) {
  const { w, h } = stageSize(stage);
  const step = Math.max(w, h) / GRID_LINES;
  const lines = Array.from({ length: GRID_LINES + 1 }, (_, i) => i * step);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label={stage.label} {...rest}>
      {stage.image ? (
        <image href={`/api/map-images/${stage.image.id}`} width={w} height={h} />
      ) : (
        <g stroke="#27272a" strokeWidth={Math.max(w, h) / 800}>
          <rect x={0} y={0} width={w} height={h} fill="#09090b" />
          {lines.map((v) => (
            <g key={v}>
              <line x1={v} x2={v} y1={0} y2={h} />
              <line x1={0} x2={w} y1={v} y2={v} />
            </g>
          ))}
        </g>
      )}
      {children}
    </svg>
  );
}
