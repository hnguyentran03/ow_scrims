"use client";

import { Button } from "@/components/button";
import { formatDuration } from "@/lib/format";
import type { Speed } from "./replay-panel";

const SPEEDS: Speed[] = [1, 2, 4];

/** Keys whose release on the range input should seek — moving it in some direction — as opposed to every key release (e.g. Tab). */
const SEEK_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

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
        onKeyUp={(e) => {
          if (SEEK_KEYS.has(e.key)) props.onSeek(Number((e.target as HTMLInputElement).value));
        }}
        className="w-full"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button size="sm" onClick={() => props.onStep(-5)} aria-label="Back five seconds">«</Button>
        <Button size="sm" onClick={() => props.onStep(-1)} aria-label="Back one second">‹</Button>
        <Button size="sm" onClick={props.onToggle} className="w-16">{playing ? "Pause" : "Play"}</Button>
        <Button size="sm" onClick={() => props.onStep(1)} aria-label="Forward one second">›</Button>
        <Button size="sm" onClick={() => props.onStep(5)} aria-label="Forward five seconds">»</Button>
        <span className="tabular-nums text-ink">{formatDuration(t)} / {formatDuration(duration)}</span>
        <span className="ml-auto flex gap-1">
          {SPEEDS.map((s) => (
            <Button key={s} size="sm" variant={speed === s ? "primary" : "secondary"} onClick={() => props.onSpeed(s)} aria-pressed={speed === s}>
              {s}×
            </Button>
          ))}
        </span>
      </div>
    </div>
  );
}
