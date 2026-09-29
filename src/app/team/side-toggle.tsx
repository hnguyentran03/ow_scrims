"use client";

import type { SideKey } from "@/lib/stats/sides";

/** The ours/theirs pressed-button pair used by the hero picks table, shared by the impact tables. */
export function SideToggle({ side, onChange, labels }: { side: SideKey; onChange: (side: SideKey) => void; labels: Record<SideKey, string> }) {
  return (
    <div className="flex gap-2 text-xs">
      {(["ours", "theirs"] as const).map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)} aria-pressed={side === s} className={`rounded px-2 py-0.5 ${side === s ? "bg-zinc-100 text-black" : "bg-zinc-800 text-zinc-300"}`}>
          {labels[s]}
        </button>
      ))}
    </div>
  );
}
