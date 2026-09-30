import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Table, Td, Th } from "@/components/table";
import { formatPct } from "@/lib/format";
import { RAMP_CLASS, RAMP_TEXT, rampStep } from "@/lib/ramp";
import type { MatrixCell, PlayerMapMatrix } from "@/lib/stats/player-map-matrix";

const cellTitle = (c: MatrixCell) => `${c.won}-${c.lost}${c.undecided > 0 ? `, ${c.undecided} undecided` : ""}, ${formatPct(c.winRate)}`;

export function PlayerMapMatrixTable({ matrix }: { matrix: PlayerMapMatrix }) {
  return (
    <Card title="Players by map" note="Record on our side per map; shade is the win rate.">
      {matrix.rows.length === 0 ? (
        <EmptyState>No hero time on our side in this range.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th pin="first">Player</Th>
              {matrix.columns.map((c) => (
                <Th key={c.mapName} numeric title={c.mapType}>{c.mapName}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((r) => (
              <tr key={r.name}>
                <Td pin="first">{r.name}</Td>
                {r.cells.map((cell, i) => {
                  const step = cell ? rampStep(cell.winRate) : null;
                  return (
                    <Td key={matrix.columns[i].mapName} numeric className={step !== null ? `${RAMP_CLASS[step]} ${RAMP_TEXT[step]}` : ""} title={cell ? cellTitle(cell) : undefined}>
                      {cell ? `${cell.won}-${cell.lost}` : ""}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
