"use client";

import { useState, useTransition } from "react";
import { getGhostAction } from "@/app/actions";
import { Select } from "@/components/field";
import type { Ghost, GhostOption } from "@/lib/ghost";

export type Alignment = "start" | "first-kill";

export function GhostSelect({ options, mapId, windowIndex, alignment, onAlignment, onGhost }: {
  options: GhostOption[];
  mapId: number;
  windowIndex: number;
  alignment: Alignment;
  onAlignment: (a: Alignment) => void;
  onGhost: (g: Ghost | null) => void;
}) {
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function choose(value: string) {
    setChoice(value);
    setNote(null);
    if (!value) {
      onGhost(null);
      return;
    }
    const [sourceMapId, sourceWindow] = value.split(":").map(Number);
    start(async () => {
      try {
        const ghost = await getGhostAction({ mapId, window: windowIndex, sourceMapId, sourceWindow });
        if (!ghost) setNote("Not available");
        onGhost(ghost);
      } catch {
        setNote("Not available");
        onGhost(null);
      }
    });
  }

  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label>
        Ghost{" "}
        <Select size="sm" value={choice} disabled={pending} onChange={(e) => choose(e.target.value)}>
          <option value="">None</option>
          {options.map((o) => <option key={`${o.mapId}:${o.window}`} value={`${o.mapId}:${o.window}`}>{o.label}</option>)}
        </Select>
      </label>
      <span className="flex gap-2 text-muted">
        {(["start", "first-kill"] as const).map((a) => (
          <label key={a} className="flex items-center gap-1">
            <input type="radio" name="ghost-align" checked={alignment === a} onChange={() => onAlignment(a)} /> {a === "start" ? "align by round start" : "align by first kill"}
          </label>
        ))}
      </span>
      {note && <span className="text-muted">{note}</span>}
    </div>
  );
}
