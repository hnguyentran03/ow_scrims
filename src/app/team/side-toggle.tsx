"use client";

import { Button } from "@/components/button";
import type { SideKey } from "@/lib/stats/sides";

/** The ours/theirs pressed-button pair used by the hero picks table, shared by the impact tables. */
export function SideToggle({ side, onChange, labels }: { side: SideKey; onChange: (side: SideKey) => void; labels: Record<SideKey, string> }) {
  return (
    <div className="flex gap-2">
      {(["ours", "theirs"] as const).map((s) => (
        <Button key={s} variant={side === s ? "primary" : "secondary"} size="sm" onClick={() => onChange(s)} aria-pressed={side === s}>
          {labels[s]}
        </Button>
      ))}
    </div>
  );
}
