"use client";

import { formatDuration } from "@/lib/format";
import type { Speed } from "./replay-panel";

const SPEEDS: Speed[] = [1, 2, 4];

export function ReplayControls(props: {
  t: number;
  duration: number;
  playing: boolean;
  speed: Speed;
  onToggle: () => void;
  onScrub: (t: number) => void;
  onSeek: (t: number) => void;
  onStep: (dt: number) => void;
  onSpeed: (s: Speed) => void;
}) {
  const { t, duration, playing, speed } = props;
  const button = "rounded border border-zinc-700 px-2 py-1 text-sm hover:border-zinc-400";
  return (
    <div className="space-y-2">
      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={t}
        aria-label="Match time"
        onChange={(e) => props.onScrub(Number(e.target.value))}
        onPointerUp={(e) => props.onSeek(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => props.onSeek(Number((e.target as HTMLInputElement).value))}
        className="w-full"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => props.onStep(-5)} className={button} aria-label="Back five seconds">«</button>
        <button type="button" onClick={() => props.onStep(-1)} className={button} aria-label="Back one second">‹</button>
        <button type="button" onClick={props.onToggle} className={`${button} w-16`}>{playing ? "Pause" : "Play"}</button>
        <button type="button" onClick={() => props.onStep(1)} className={button} aria-label="Forward one second">›</button>
        <button type="button" onClick={() => props.onStep(5)} className={button} aria-label="Forward five seconds">»</button>
        <span className="tabular-nums text-zinc-300">{formatDuration(t)} / {formatDuration(duration)}</span>
        <span className="ml-auto flex gap-1">
          {SPEEDS.map((s) => (
            <button key={s} type="button" onClick={() => props.onSpeed(s)} aria-pressed={speed === s} className={`${button} ${speed === s ? "border-zinc-100" : "text-zinc-400"}`}>
              {s}×
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
