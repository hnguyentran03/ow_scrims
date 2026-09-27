"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Replay, ReplayStage } from "@/lib/stats/replay";
import type { Sides } from "@/lib/stats/sides";
import { windowIndexAt } from "@/lib/stats/stages";
import { ReplayCanvas } from "./replay-canvas";
import { ReplayControls } from "./replay-controls";
import { ReplayFeed } from "./replay-feed";
import { ReplayPlayers } from "./replay-players";

export type Speed = 1 | 2 | 4;

const NO_POSITIONS = "Position logging was off for this map. Turn on position logging in the ScrimTime Workshop settings before hosting.";

export function ReplayPanel({ replay, sides, mapName, initialTime }: { replay: Replay; sides: Sides; mapName: string; initialTime: number }) {
  const pathname = usePathname();
  const duration = replay.durationSeconds;
  const [t, setT] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const windowIndex = windowIndexAt(t, replay.stages);

  /**
   * Writes the paused time to the URL via the native History API so a pause/step/seek never triggers a
   * server round-trip on this force-dynamic route. Next syncs `usePathname`/`useSearchParams` (and thus
   * `Tabs`) with native history calls without re-fetching. Never called while playing.
   */
  const commit = useCallback(
    (time: number) => {
      const q = new URLSearchParams(window.location.search);
      q.set("t", time.toFixed(1));
      window.history.replaceState(null, "", `${pathname}?${q.toString()}`);
    },
    [pathname],
  );

  const clamp = (time: number) => Math.min(Math.max(time, 0), duration);
  /** Updates `t` and, unless playback is running, commits it to the URL. While playing, the next pause commits the current time. */
  const seek = (time: number) => {
    const next = clamp(time);
    setT(next);
    if (!playing) commit(next);
  };
  const step = (dt: number) => seek(t + dt);
  /** Selecting a window keeps `t` when it already falls inside it, otherwise seeks to the window's start. */
  const selectWindow = (w: ReplayStage) => {
    if (t < w.start || t > w.end) seek(w.start);
  };
  const toggle = () => {
    if (playing) {
      setPlaying(false);
      commit(t);
    } else {
      if (t >= duration) setT(0);
      setPlaying(true);
    }
  };

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setT((prev) => Math.min(prev + dt, duration));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, duration]);

  useEffect(() => {
    if (playing && t >= duration) {
      setPlaying(false);
      commit(duration);
    }
  }, [playing, t, duration, commit]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (tag === "BUTTON" && e.key === " ") return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(e.shiftKey ? -5 : -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(e.shiftKey ? 5 : 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-4">
      {replay.stages.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {replay.stages.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectWindow(s)}
              className={`rounded border px-2 py-1 text-sm ${i === windowIndex ? "border-zinc-100" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {replay.hasPositions ? (
            <ReplayCanvas replay={replay} t={t} windowIndex={windowIndex} mapName={mapName} />
          ) : (
            <p className="rounded border border-zinc-800 p-4 text-sm text-zinc-400">{NO_POSITIONS}</p>
          )}
          <ReplayControls t={t} duration={duration} playing={playing} speed={speed} onToggle={toggle} onScrub={(v) => setT(clamp(v))} onSeek={seek} onStep={step} onSpeed={setSpeed} />
        </div>
        <div className="space-y-6">
          <ReplayPlayers replay={replay} sides={sides} t={t} />
          <ReplayFeed feed={replay.feed} sides={sides} t={t} playing={playing} onSeek={seek} />
        </div>
      </div>
      <p className="text-xs text-zinc-500">Space plays and pauses; ← and → step one second, five with Shift. {mapName} · {sides.ours} vs {sides.theirs}.</p>
    </div>
  );
}
