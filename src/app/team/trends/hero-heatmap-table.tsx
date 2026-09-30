import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Table, Td, Th } from "@/components/table";
import { formatPct } from "@/lib/format";
import { RAMP_CLASS, rampStep } from "@/lib/ramp";
import type { HeroHeatmap } from "@/lib/stats/hero-heatmap";

const LEGEND = [0, 0.25, 0.5, 0.75, 1] as const;

export function HeroHeatmapTable({ heatmap }: { heatmap: HeroHeatmap }) {
  return (
    <Card
      title="Hero picks by scrim"
      note="Share of each scrim's maps where we played the hero."
      actions={
        <span className="flex items-center gap-1 text-xs text-muted">
          {LEGEND.map((v) => (
            <span key={v} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-3 border border-line ${RAMP_CLASS[rampStep(v)]}`} aria-hidden />
              {formatPct(v)}
            </span>
          ))}
        </span>
      }
    >
      {heatmap.rows.length === 0 ? (
        <EmptyState>No hero time on our side in this range.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th pin="first">Hero</Th>
              {heatmap.columns.map((c) => (
                <Th key={c.scrimId} numeric title={c.name}>{c.date}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((r) => (
              <tr key={r.hero}>
                <Td pin="first" title={`${r.hero}, ${r.role}`}>{r.hero}</Td>
                {r.cells.map((cell, i) => (
                  <Td key={heatmap.columns[i].scrimId} numeric className={`${RAMP_CLASS[rampStep(cell.share)]} ${cell.picks === 0 ? "text-muted" : "text-ink"}`} title={`${cell.picks} of ${cell.maps} maps`}>
                    {formatPct(cell.share)}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
