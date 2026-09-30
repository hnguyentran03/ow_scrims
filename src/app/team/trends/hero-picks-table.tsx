"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Table, Td, Th } from "@/components/table";
import { formatDuration, formatPct } from "@/lib/format";
import type { HeroPick } from "@/lib/stats/trends";
import type { SideKey } from "@/lib/stats/sides";
import { SideToggle } from "../side-toggle";

export function HeroPicksTable({ ours, theirs }: { ours: HeroPick[]; theirs: HeroPick[] }) {
  const [side, setSide] = useState<SideKey>("ours");
  const rows = side === "ours" ? ours : theirs;
  return (
    <div className="space-y-2">
      <SideToggle side={side} onChange={setSide} labels={{ ours: "Our picks", theirs: "Their picks" }} />
      {rows.length === 0 ? (
        <EmptyState>No heroes played.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr><Th>Hero</Th><Th>Role</Th><Th numeric>Picks</Th><Th numeric>Available</Th><Th numeric>Pick %</Th><Th numeric>Playtime</Th><Th numeric>Share</Th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.hero}>
                <Td>{p.hero}</Td>
                <Td muted>{p.role}</Td>
                <Td numeric>{p.picks}</Td>
                <Td numeric>{p.available}</Td>
                <Td numeric>{formatPct(p.pickRate)}</Td>
                <Td numeric>{formatDuration(p.playtime)}</Td>
                <Td numeric>{formatPct(p.playtimeShare)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
