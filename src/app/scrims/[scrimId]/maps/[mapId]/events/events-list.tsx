"use client";

import { useMemo, useState } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import { FILTER_KEYS, FILTERS, type EventEntry, type Events, type FilterKey } from "@/lib/stats/events";
import { formatDuration } from "@/lib/format";
import type { Sides } from "@/lib/stats/sides";

const LABELS: Record<FilterKey, string> = { all: "All", highlights: "Highlights", ultimates: "Ultimates", fights: "Fights", swaps: "Swaps", objectives: "Objectives" };

export function EventsList({ events, sides }: { events: Events; sides: Sides }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const visible = useMemo(() => {
    const kinds = FILTERS[filter];
    return kinds ? events.entries.filter((e) => kinds.includes(e.kind)) : events.entries;
  }, [events, filter]);
  const t = events.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTER_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded border px-2 py-1 text-sm ${filter === key ? "border-zinc-100" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
          >
            {LABELS[key]}
          </button>
        ))}
      </div>
      <p className="text-sm text-zinc-400">
        {t.rounds} rounds · {t.fights} fights · {t.ults} ults · {t.ultKills} ults with kills · {t.multikills} multikills · {t.swaps} swaps · {t.captures} captures
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-400">No events.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 text-sm">
          {visible.map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-1">
              <span className="w-14 tabular-nums text-zinc-400">{formatDuration(e.time)}</span>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.team ? TEAM_COLORS[e.team] : "#52525b" }} />
              <span>{describe(e, sides)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describe(e: EventEntry, sides: Sides): string {
  const teamName = (t: "ours" | "theirs" | null) => (t ? sides[t] : "");
  switch (e.kind) {
    case "match_start": return "Match started";
    case "match_end": return "Match ended";
    case "round_start": return `Round ${e.roundNumber} started`;
    case "round_end": return e.capturingTeam ? `Round ${e.roundNumber} ended, captured by ${e.capturingTeam}` : `Round ${e.roundNumber} ended`;
    case "capture": return `${e.teamName} ${e.isPoint ? "took the point" : "captured the objective"}`;
    case "swap": return `${e.player} swapped ${e.from} → ${e.to}`;
    case "ult": return `${e.player} (${e.hero}) used ultimate${e.kills ? `, ${e.kills} kills` : ""}${e.fightIndex ? ` · fight ${e.fightIndex}` : ""}`;
    case "ult_kill": return `${e.player} (${e.hero}) got ${e.kills} kill${e.kills === 1 ? "" : "s"} with ultimate`;
    case "fight": return `Fight ${e.fightIndex} · ${e.winner ? `won by ${e.winner}` : "even"} (${sides.ours} ${e.ours} – ${e.theirs} ${sides.theirs})`;
    case "multikill": return `${e.player} (${e.hero}) multikill, ${e.kills} kills in fight ${e.fightIndex}`;
    case "ajax": return `Ajax: ${e.player} (${teamName(e.team)}) died during Sound Barrier${e.fightIndex ? ` · fight ${e.fightIndex}` : ""}`;
  }
}
