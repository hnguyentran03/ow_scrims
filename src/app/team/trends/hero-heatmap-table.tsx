import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ShadedTable, type ShadedColumn, type ShadedRow } from "@/components/shaded-table";
import { formatPct } from "@/lib/format";
import { RAMP_CLASS, rampStep } from "@/lib/ramp";
import type { HeroHeatmap } from "@/lib/stats/hero-heatmap";

const LEGEND = [0, 0.25, 0.5, 0.75, 1] as const;

/** One column per scrim, one row per hero; a never-picked hero keeps the base shade but dims its share. */
export function heatmapToShaded(heatmap: HeroHeatmap): { columns: ShadedColumn[]; rows: ShadedRow[] } {
  return {
    columns: heatmap.columns.map((c) => ({ key: String(c.scrimId), label: c.date, title: c.name })),
    rows: heatmap.rows.map((r) => ({
      key: r.hero,
      label: r.hero,
      title: `${r.hero}, ${r.role}`,
      cells: r.cells.map((cell) => ({ value: cell.share, text: formatPct(cell.share), title: `${cell.picks} of ${cell.maps} maps`, muted: cell.picks === 0 })),
    })),
  };
}

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
        <ShadedTable pinHead="Hero" {...heatmapToShaded(heatmap)} />
      )}
    </Card>
  );
}
