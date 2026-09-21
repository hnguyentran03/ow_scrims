"use client";

import { useTransition } from "react";
import { setMapBansAction } from "@/app/actions";
import { HEROES } from "@/lib/stats/heroes";

interface Props {
  scrimId: number;
  mapId: number;
  ourSide: number;
  bans: Array<{ side: number; hero: string }>;
}

/** Per-map bans for both teams: chips with remove buttons and an add select. Every change saves the row's full list. */
export function BansEditor({ scrimId, mapId, ourSide, bans }: Props) {
  const [pending, start] = useTransition();
  const taken = new Set(bans.map((b) => b.hero));

  function row(side: 1 | 2, label: string) {
    const heroes = bans.filter((b) => b.side === side).map((b) => b.hero);
    const save = (next: string[]) => start(() => setMapBansAction(scrimId, mapId, side, next));
    return (
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="w-12 text-zinc-500">{label}</span>
        {heroes.map((h) => (
          <span key={h} className="rounded bg-zinc-800 px-1.5 py-0.5">
            {h}{" "}
            <button type="button" aria-label={`Remove ${h}`} disabled={pending} onClick={() => save(heroes.filter((x) => x !== h))} className="text-zinc-400 hover:text-zinc-100">×</button>
          </span>
        ))}
        <select aria-label={`Add ${label.toLowerCase()} ban`} value="" disabled={pending} onChange={(e) => { if (e.target.value) save([...heroes, e.target.value]); }} className="rounded bg-zinc-900 px-1 py-0.5">
          <option value="">Add hero…</option>
          {HEROES.filter((h) => !taken.has(h)).map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
    );
  }

  const ours = ourSide === 1 ? 1 : 2;
  return (
    <div className="mt-2 space-y-1">
      <div className="text-xs uppercase tracking-wide text-zinc-500">Bans</div>
      {row(ours, "Ours")}
      {row(ours === 1 ? 2 : 1, "Theirs")}
    </div>
  );
}
