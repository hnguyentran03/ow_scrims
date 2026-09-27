"use client";

import { useEffect, useRef } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import { formatDuration } from "@/lib/format";
import type { FeedEntry } from "@/lib/stats/replay";
import type { Sides } from "@/lib/stats/sides";
import { describeEvent } from "../events/events-list";

export function feedLabel(e: FeedEntry, sides: Sides): string {
  if (e.kind === "kill") {
    if (e.killKind === "suicide") return `${e.victim} (${e.victimHero}) died`;
    if (e.killKind === "environmental") return `${e.victim} (${e.victimHero}) died to the environment`;
    return `${e.attacker} (${e.attackerHero}) killed ${e.victim} (${e.victimHero})`;
  }
  if (e.kind === "rez") return `${e.player} resurrected ${e.target}`;
  return describeEvent(e, sides);
}

export function ReplayFeed({ feed, sides, t, playing, onSeek }: { feed: FeedEntry[]; sides: Sides; t: number; playing: boolean; onSeek: (t: number) => void }) {
  const visible = feed.filter((e) => e.time <= t);
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (playing) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [visible.length, playing]);
  return (
    <section className="space-y-2 rounded border border-zinc-800 p-3">
      <h2 className="text-sm font-medium">Feed</h2>
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-400">Nothing yet.</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
          {visible.map((e, i) => (
            <li key={i} ref={i === visible.length - 1 ? endRef : undefined}>
              <button type="button" onClick={() => onSeek(e.time)} className="flex w-full items-center gap-2 text-left hover:bg-zinc-900">
                <span className="w-12 shrink-0 tabular-nums text-zinc-400">{formatDuration(e.time)}</span>
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: e.team ? TEAM_COLORS[e.team] : "#52525b" }} />
                <span>{feedLabel(e, sides)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
