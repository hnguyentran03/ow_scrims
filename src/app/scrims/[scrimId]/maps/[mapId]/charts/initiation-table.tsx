import { TEAM_COLORS } from "@/lib/colors";
import { formatPct } from "@/lib/format";
import type { Initiation, InitiationSummary } from "@/lib/stats/initiation";
import type { SideKey, Sides } from "@/lib/stats/sides";

function summaryLine(side: SideKey, s: InitiationSummary, sides: Sides, total: number): string {
  const other = side === "ours" ? "theirs" : "ours";
  const fightWord = total === 1 ? "fight" : "fights";
  const decidedInitiated = s.initiationWinRate === null ? "" : ` (${formatPct(s.initiationWinRate)} of decided)`;
  const first = s.initiated
    ? `Engaged first in ${s.initiated} of ${total} ${fightWord}, won ${s.wonWhenInitiated}${decidedInitiated}`
    : "Never engaged first";
  const decidedNotInitiated = s.nonInitiationWinRate === null ? "" : ` (${formatPct(s.nonInitiationWinRate)} of decided)`;
  const second = s.fightsNotInitiated
    ? `won ${s.wonWhenNotInitiated} of ${s.fightsNotInitiated} when ${sides[other]} engaged first${decidedNotInitiated}`
    : `no fights where ${sides[other]} engaged first`;
  return `${sides[side]}: ${first}; ${second}.`;
}

export function InitiationTable({ initiation, sides }: { initiation: Initiation; sides: Sides }) {
  if (!initiation.hasDamage) {
    return <p className="text-sm text-zinc-400">Damage logging was off for this map. Turn on damage logging in the ScrimTime Workshop settings before hosting.</p>;
  }
  if (initiation.fights.length === 0) return <p className="text-sm text-zinc-400">No fights recorded.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">{summaryLine("ours", initiation.summary.ours, sides, initiation.fights.length)}</p>
      <p className="text-xs text-zinc-500">{summaryLine("theirs", initiation.summary.theirs, sides, initiation.fights.length)}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="px-2 py-1">Fight</th>
            <th className="px-2 py-1">Engaged by</th>
            <th className="px-2 py-1 text-right">Before first kill</th>
            <th className="px-2 py-1">Winner</th>
          </tr>
        </thead>
        <tbody>
          {initiation.fights.map((f) => (
            <tr key={f.index} className="border-t border-zinc-800">
              <td className="px-2 py-1 tabular-nums">{f.index}</td>
              <td className="px-2 py-1" style={{ color: f.initiator?.side ? TEAM_COLORS[f.initiator.side] : undefined }}>
                {f.initiator ? `${f.initiator.name} (${f.initiator.hero})` : <span className="text-zinc-500">unknown</span>}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {f.secondsToFirstKill === null ? "–" : f.secondsToFirstKill < 0 ? `${Math.abs(f.secondsToFirstKill).toFixed(1)} s after` : `${f.secondsToFirstKill.toFixed(1)} s`}
              </td>
              <td className="px-2 py-1" style={{ color: f.winner ? TEAM_COLORS[f.winner] : undefined }}>{f.winner ? sides[f.winner] : "even"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-zinc-500">A fight starts at its first kill.</p>
    </div>
  );
}
