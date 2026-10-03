import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ShadedTable, type ShadedColumn, type ShadedRow } from "@/components/shaded-table";
import { formatPct } from "@/lib/format";
import type { MatrixCell, PlayerMapMatrix } from "@/lib/stats/player-map-matrix";

const cellTitle = (c: MatrixCell) => `${c.won}-${c.lost}${c.undecided > 0 ? `, ${c.undecided} undecided` : ""}, ${formatPct(c.winRate)}`;

/** One column per map, one row per player; a map the player never had time on stays null. */
export function matrixToShaded(matrix: PlayerMapMatrix): { columns: ShadedColumn[]; rows: ShadedRow[] } {
  return {
    columns: matrix.columns.map((c) => ({ key: c.mapName, label: c.mapName, title: c.mapType })),
    rows: matrix.rows.map((r) => ({
      key: r.name,
      label: r.name,
      cells: r.cells.map((cell) => (cell ? { value: cell.winRate, text: `${cell.won}-${cell.lost}`, title: cellTitle(cell) } : null)),
    })),
  };
}

export function PlayerMapMatrixTable({ matrix }: { matrix: PlayerMapMatrix }) {
  return (
    <Card title="Players by map" note="Record on our side per map; shade is the win rate.">
      {matrix.rows.length === 0 ? (
        <EmptyState>No hero time on our side in this range.</EmptyState>
      ) : (
        <ShadedTable pinHead="Player" {...matrixToShaded(matrix)} />
      )}
    </Card>
  );
}
