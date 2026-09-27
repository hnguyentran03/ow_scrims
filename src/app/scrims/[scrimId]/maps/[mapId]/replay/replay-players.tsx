"use client";

import { TEAM_COLORS } from "@/lib/colors";
import { heroAbbrev } from "@/lib/hero-abbrev";
import { heroAt, ultStateAt } from "@/lib/stats/playback";
import type { Replay } from "@/lib/stats/replay";
import type { SideKey, Sides } from "@/lib/stats/sides";
import { DEATH_MARKER_SECONDS } from "@/lib/stats/tracks";

const ULT_LABEL = { charged: "ult ready", using: "ulting" } as const;

export function ReplayPlayers({ replay, sides, t }: { replay: Replay; sides: Sides; t: number }) {
  const column = (side: SideKey) => (
    <div>
      <h3 className="mb-1 text-xs uppercase tracking-wide" style={{ color: TEAM_COLORS[side] }}>{sides[side]}</h3>
      <ul className="space-y-1 text-sm">
        {replay.players.filter((p) => p.side === side).map((p) => {
          const hero = heroAt(replay.heroes, p.team, p.name, t);
          const dead = replay.deaths.some((d) => d.team === p.team && d.name === p.name && d.t <= t && t < d.t + DEATH_MARKER_SECONDS);
          const ult = ultStateAt(replay.ultStates, replay.ults, p.team, p.name, t);
          return (
            <li key={p.name} className={`flex items-center gap-2 ${dead ? "text-zinc-500 line-through" : ""}`}>
              <span className="inline-flex h-5 w-6 items-center justify-center rounded text-[10px] font-semibold text-zinc-50" style={{ background: TEAM_COLORS[side] }}>{heroAbbrev(hero)}</span>
              <span className="truncate">{p.name}</span>
              <span className="truncate text-zinc-400">{hero || "?"}</span>
              {ult && <span className="ml-auto rounded bg-zinc-800 px-1 text-xs text-zinc-200">{ULT_LABEL[ult]}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <section className="grid grid-cols-2 gap-3 rounded border border-zinc-800 p-3">
      {column("ours")}
      {column("theirs")}
    </section>
  );
}
