import { TEAM_COLORS } from "@/lib/colors";
import type { Sides } from "@/lib/stats/sides";
import type { AdvantageBucket, UltAdvantage } from "@/lib/stats/ult-analysis";

const rate = (b: AdvantageBucket) => (b.fights ? `${b.won}/${b.fights}` : "–");

export function UltAdvantageTable({ advantage, sides }: { advantage: UltAdvantage | null; sides: Sides }) {
  if (!advantage) return <p className="text-sm text-zinc-400">No ultimate charge events on this map.</p>;
  if (advantage.fights.length === 0) return <p className="text-sm text-zinc-400">No fights recorded.</p>;
  const { ahead, even, behind } = advantage.summary;
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">Fights won when ahead {rate(ahead)} · even {rate(even)} · behind {rate(behind)}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="px-2 py-1">Fight</th>
            <th className="px-2 py-1 text-right">{sides.ours}</th>
            <th className="px-2 py-1 text-right">{sides.theirs}</th>
            <th className="px-2 py-1 text-right">Adv.</th>
            <th className="px-2 py-1">Winner</th>
          </tr>
        </thead>
        <tbody>
          {advantage.fights.map((f) => (
            <tr key={f.index} className="border-t border-zinc-800">
              <td className="px-2 py-1">{f.index}</td>
              <td className="px-2 py-1 text-right tabular-nums">{f.ours}</td>
              <td className="px-2 py-1 text-right tabular-nums">{f.theirs}</td>
              <td className="px-2 py-1 text-right tabular-nums">{f.advantage > 0 ? `+${f.advantage}` : f.advantage}</td>
              <td className="px-2 py-1" style={{ color: f.winner ? TEAM_COLORS[f.winner] : undefined }}>{f.winner ? sides[f.winner] : "even"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
