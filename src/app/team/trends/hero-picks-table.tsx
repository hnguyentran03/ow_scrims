"use client";

import { useState } from "react";
import { formatDuration, formatPct } from "@/lib/format";
import type { HeroPick } from "@/lib/stats/trends";
import type { SideKey } from "@/lib/stats/sides";

export function HeroPicksTable({ ours, theirs }: { ours: HeroPick[]; theirs: HeroPick[] }) {
  const [side, setSide] = useState<SideKey>("ours");
  const rows = side === "ours" ? ours : theirs;
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs">
        {(["ours", "theirs"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSide(s)} aria-pressed={side === s} className={`rounded px-2 py-0.5 ${side === s ? "bg-zinc-100 text-black" : "bg-zinc-800 text-zinc-300"}`}>
            {s === "ours" ? "Our picks" : "Their picks"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-400">No heroes played.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="py-1">Hero</th><th>Role</th><th>Picks</th><th>Available</th><th>Pick %</th><th>Playtime</th><th>Share</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.hero} className="border-t border-zinc-800 tabular-nums">
                <td className="py-1">{p.hero}</td><td className="text-zinc-400">{p.role}</td><td>{p.picks}</td><td>{p.available}</td><td>{formatPct(p.pickRate)}</td><td>{formatDuration(p.playtime)}</td><td>{formatPct(p.playtimeShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
