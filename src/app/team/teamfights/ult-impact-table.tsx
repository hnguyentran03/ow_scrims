"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Table, Td, Th } from "@/components/table";
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
        <EmptyState>No ultimates cast.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr><Th>Hero</Th><Th numeric>Casts</Th><Th numeric>With</Th><Th numeric>Without</Th><Th numeric>Lift</Th><Th numeric>Conv. kills / cast</Th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.hero}>
                <Td>{r.hero} <span className="text-muted">{r.role}</span></Td>
                <Td numeric>{r.casts}{r.unattributed > 0 && <span className="text-muted"> ({r.unattributed} after the last fight)</span>}</Td>
                <Td numeric>{winLoss(r.with)}</Td>
                <Td numeric>{winLoss(r.without)}</Td>
                <Td numeric>{lift(r.lift)}</Td>
                <Td numeric>{two(r.conversionKillsPerCast)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
