"use client";

import { useTransition } from "react";
import { setMapBansAction } from "@/app/actions";
import { Select } from "@/components/field";
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
        <span className="w-12 text-muted">{label}</span>
        {heroes.map((h) => (
          <span key={h} className="slant-sm bg-raised px-2 py-0.5">
            {h}{" "}
            <button type="button" aria-label={`Remove ${h}`} disabled={pending} onClick={() => save(heroes.filter((x) => x !== h))} className="text-muted hover:text-ink">×</button>
          </span>
        ))}
        <Select size="sm" aria-label={`Add ${label.toLowerCase()} ban`} value="" disabled={pending} onChange={(e) => { if (e.target.value) save([...heroes, e.target.value]); }}>
          <option value="">Add hero…</option>
          {HEROES.filter((h) => !taken.has(h)).map((h) => <option key={h} value={h}>{h}</option>)}
        </Select>
      </div>
    );
  }

  const ours = ourSide === 1 ? 1 : 2;
  return (
    <div className="mt-2 space-y-1">
      <div className="text-sm text-muted">Bans</div>
      {row(ours, "Ours")}
      {row(ours === 1 ? 2 : 1, "Theirs")}
    </div>
  );
}
