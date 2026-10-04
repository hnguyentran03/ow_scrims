"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { TEAM_COLORS } from "@/lib/colors";
import { FILTER_KEYS, FILTERS, type EventEntry, type Events, type FilterKey } from "@/lib/stats/events";
import { formatDuration } from "@/lib/format";
import { CONVERSION_WINDOW_SECONDS } from "@/lib/stats/ult-analysis";
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
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "primary" : "secondary"}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
          >
            {LABELS[key]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 text-sm text-muted">
        <span>{t.rounds} rounds</span>
        <span>{t.fights} fights</span>
        <span>{t.ults} ults</span>
        <span>{t.ultKills} ults with final blows</span>
        <span>{t.multikills} multikills</span>
        <span>{t.swaps} swaps</span>
        <span>{t.captures} captures</span>
      </div>
      {visible.length === 0 ? (
        <EmptyState>No events match this filter.</EmptyState>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {visible.map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-1">
              <span className="w-14 tabular-nums text-muted">{formatDuration(e.time)}</span>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.team ? TEAM_COLORS[e.team] : "var(--color-muted)" }} />
              <span>{describeEvent(e, sides)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function describeEvent(e: EventEntry, sides: Sides): string {
  const teamName = (t: "ours" | "theirs" | null) => (t ? sides[t] : "");
  switch (e.kind) {
    case "match_start": return "Match started";
    case "match_end": return "Match ended";
    case "round_start": return `Round ${e.roundNumber} started`;
    case "round_end": return e.capturingTeam ? `Round ${e.roundNumber} ended, captured by ${e.capturingTeam}` : `Round ${e.roundNumber} ended`;
    case "capture": return `${e.teamName} ${e.isPoint ? "took the point" : "captured the objective"}`;
    case "swap": return `${e.player} swapped ${e.from} → ${e.to}`;
    case "ult": {
      const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
      const parts = [`${e.player} (${e.hero}) used ultimate${e.kills ? `, ${plural(e.kills, "final blow")}` : ""}`];
      if (e.conversionKills) parts.push(`${plural(e.conversionKills, "team final blow")} in ${CONVERSION_WINDOW_SECONDS} s`);
      if (e.diedDuringUlt) parts.push("died during ult");
      if (e.fightIndex) parts.push(`fight ${e.fightIndex}`);
      return parts.join(", ");
    }
    case "ult_kill": return `${e.player} (${e.hero}) got ${e.kills} final blow${e.kills === 1 ? "" : "s"} with ultimate`;
    case "fight": return `Fight ${e.fightIndex}, ${e.winner ? `won by ${e.winner}` : "even"} (${sides.ours} ${e.ours} – ${e.theirs} ${sides.theirs})`;
    case "multikill": return `${e.player} (${e.hero}) multikill, ${e.kills} kills in fight ${e.fightIndex}`;
    case "ajax": return `Ajax: ${e.player} (${teamName(e.team)}) died during Sound Barrier${e.fightIndex ? `, fight ${e.fightIndex}` : ""}`;
  }
}
