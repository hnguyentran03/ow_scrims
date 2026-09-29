"use client";

import { useState } from "react";
import { formatPct } from "@/lib/format";
import type { SideKey } from "@/lib/stats/sides";
import type { ImpactRatio, UltImpactRow } from "@/lib/stats/ult-impact";
import { SideToggle } from "../side-toggle";

/** "3–1 (75%)": wins, losses among decided fights, and the rate; draws are in the count but shown nowhere. */
export const winLoss = (r: ImpactRatio) => (r.count === 0 ? "–" : `${r.won}–${r.decided - r.won} (${formatPct(r.rate)})`);
export const lift = (v: number | null) => (v === null ? "–" : `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`);
const two = (v: number | null) => (v === null ? "–" : v.toFixed(2));

export function UltImpactTable({ ours, theirs }: { ours: UltImpactRow[]; theirs: UltImpactRow[] }) {
  const [side, setSide] = useState<SideKey>("ours");
  const rows = side === "ours" ? ours : theirs;
  return (
    <div className="space-y-2">
      <SideToggle side={side} onChange={setSide} labels={{ ours: "Our ults", theirs: "Their ults" }} />
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-400">No ultimates cast.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="py-1">Hero</th><th>Casts</th><th>With</th><th>Without</th><th>Lift</th><th>Conv. kills / cast</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.hero} className="border-t border-zinc-800 tabular-nums">
                <td className="py-1">{r.hero} <span className="text-zinc-500">{r.role}</span></td>
                <td>{r.casts}{r.unattributed > 0 && <span className="text-zinc-500"> ({r.unattributed} outside fights)</span>}</td>
                <td>{winLoss(r.with)}</td>
                <td>{winLoss(r.without)}</td>
                <td>{lift(r.lift)}</td>
                <td>{two(r.conversionKillsPerCast)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
