"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Table, Td, Th } from "@/components/table";
import type { AbilityImpactRow } from "@/lib/stats/ability-impact";
import type { SideKey } from "@/lib/stats/sides";
import { SideToggle } from "../side-toggle";
import { lift, winLoss } from "./ult-impact-table";

const two = (v: number | null) => (v === null ? "–" : v.toFixed(2));

export function AbilityImpactTable({ ours, theirs, hasAbilities }: { ours: AbilityImpactRow[]; theirs: AbilityImpactRow[]; hasAbilities: boolean }) {
  const [side, setSide] = useState<SideKey>("ours");
  const rows = side === "ours" ? ours : theirs;
  if (!hasAbilities) return <EmptyState>No ability events in this range. Ability logging depends on the Workshop mode version; many older logs do not have it.</EmptyState>;
  return (
    <div className="space-y-2">
      <SideToggle side={side} onChange={setSide} labels={{ ours: "Our abilities", theirs: "Their abilities" }} />
      {rows.length === 0 ? (
        <EmptyState>No abilities used.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr><Th>Hero</Th><Th>Ability</Th><Th numeric>Uses</Th><Th numeric>Per fight won</Th><Th numeric>Per fight lost</Th><Th numeric>With</Th><Th numeric>Without</Th><Th numeric>Lift</Th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.hero}|${r.slot}`}>
                <Td>{r.hero}</Td>
                <Td>{r.ability}</Td>
                <Td numeric>{r.uses}</Td>
                <Td numeric>{two(r.perFightWon)}</Td>
                <Td numeric>{two(r.perFightLost)}</Td>
                <Td numeric>{winLoss(r.with)}</Td>
                <Td numeric>{winLoss(r.without)}</Td>
                <Td numeric>{lift(r.lift)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
