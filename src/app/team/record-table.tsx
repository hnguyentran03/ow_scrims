import { formatPct } from "@/lib/format";

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

export function RecordTable({ rows, head }: { rows: RecordRow[]; head: string }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">Nothing in range.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr><th className="py-1">{head}</th><th>Played</th><th>W</th><th>L</th><th>N/A</th><th>Win %</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-zinc-800 tabular-nums">
            <td className="py-1">{r.label}{r.sub && <span className="ml-2 text-xs text-zinc-500">{r.sub}</span>}</td>
            <td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.undecided}</td><td>{formatPct(r.winRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
