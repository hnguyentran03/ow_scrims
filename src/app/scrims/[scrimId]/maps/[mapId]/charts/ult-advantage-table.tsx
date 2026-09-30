import { Table, Td, Th } from "@/components/table";
import { TEAM_COLORS } from "@/lib/colors";
import type { Sides } from "@/lib/stats/sides";
import type { AdvantageBucket, UltAdvantage } from "@/lib/stats/ult-analysis";

const rate = (b: AdvantageBucket) => (b.fights ? `${b.won}/${b.fights}` : "–");

export function UltAdvantageTable({ advantage, sides }: { advantage: UltAdvantage | null; sides: Sides }) {
  if (!advantage) return <p className="text-sm text-muted">No ultimate charge events on this map.</p>;
  if (advantage.fights.length === 0) return <p className="text-sm text-muted">No fights recorded.</p>;
  const { ahead, even, behind } = advantage.summary;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Fights won when ahead {rate(ahead)}, even {rate(even)}, behind {rate(behind)}</p>
      <Table>
        <thead>
          <tr>
            <Th>Fight</Th>
            <Th numeric>{sides.ours}</Th>
            <Th numeric>{sides.theirs}</Th>
            <Th numeric>Adv.</Th>
            <Th>Winner</Th>
          </tr>
        </thead>
        <tbody>
          {advantage.fights.map((f) => (
            <tr key={f.index}>
              <Td>{f.index}</Td>
              <Td numeric className="tabular-nums">{f.ours}</Td>
              <Td numeric className="tabular-nums">{f.theirs}</Td>
              <Td numeric className="tabular-nums">{f.advantage > 0 ? `+${f.advantage}` : f.advantage}</Td>
              <Td style={{ color: f.winner ? TEAM_COLORS[f.winner] : undefined }}>{f.winner ? sides[f.winner] : "even"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
