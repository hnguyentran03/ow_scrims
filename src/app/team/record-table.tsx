import { Table, Td, Th } from "@/components/table";
import { formatPct } from "@/lib/format";
import type { MapRecord, TypeRecord } from "@/lib/stats/trends";
import { Empty } from "./empty";

export interface RecordRow {
  key: string;
  label: string;
  sub?: string;
  played: number;
  won: number;
  lost: number;
  undecided: number;
  winRate: number | null;
}

export const mapRecordRows = (rows: MapRecord[]): RecordRow[] => rows.map((r) => ({ ...r, key: r.mapName, label: r.mapName, sub: r.mapType }));
export const typeRecordRows = (rows: TypeRecord[]): RecordRow[] => rows.map((r) => ({ ...r, key: r.mapType, label: r.mapType }));

export function RecordTable({ rows, head }: { rows: RecordRow[]; head: string }) {
  if (rows.length === 0) return <Empty />;
  return (
    <Table>
      <thead>
        <tr><Th>{head}</Th><Th numeric>Played</Th><Th numeric>W</Th><Th numeric>L</Th><Th numeric>N/A</Th><Th numeric>Win %</Th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <Td>{r.label}{r.sub && <span className="ml-2 text-xs text-muted">{r.sub}</span>}</Td>
            <Td numeric>{r.played}</Td><Td numeric>{r.won}</Td><Td numeric>{r.lost}</Td><Td numeric>{r.undecided}</Td><Td numeric>{formatPct(r.winRate)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
