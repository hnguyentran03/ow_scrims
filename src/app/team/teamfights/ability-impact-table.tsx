"use client";

import { useState } from "react";
import type { AbilityImpactRow } from "@/lib/stats/ability-impact";
import type { SideKey } from "@/lib/stats/sides";
import { SideToggle } from "../side-toggle";
import { lift, winLoss } from "./ult-impact-table";

const two = (v: number | null) => (v === null ? "–" : v.toFixed(2));

export function AbilityImpactTable({ ours, theirs, hasAbilities }: { ours: AbilityImpactRow[]; theirs: AbilityImpactRow[]; hasAbilities: boolean }) {
  const [side, setSide] = useState<SideKey>("ours");
  const rows = side === "ours" ? ours : theirs;
  if (!hasAbilities) return <p className="text-sm text-zinc-400">No ability events in this range. Ability logging depends on the Workshop mode version; many older logs do not have it.</p>;
  return (
    <div className="space-y-2">
      <SideToggle side={side} onChange={setSide} labels={{ ours: "Our abilities", theirs: "Their abilities" }} />
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-400">No abilities used.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="py-1">Hero</th><th>Ability</th><th>Uses</th><th>Per fight won</th><th>Per fight lost</th><th>With</th><th>Without</th><th>Lift</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.hero}|${r.slot}`} className="border-t border-zinc-800 tabular-nums">
                <td className="py-1">{r.hero}</td>
                <td>{r.ability}</td>
                <td>{r.uses}</td>
                <td>{two(r.perFightWon)}</td>
                <td>{two(r.perFightLost)}</td>
                <td>{winLoss(r.with)}</td>
                <td>{winLoss(r.without)}</td>
                <td>{lift(r.lift)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
