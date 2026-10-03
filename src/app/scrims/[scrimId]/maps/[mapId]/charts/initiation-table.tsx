import { Table, Td, Th } from "@/components/table";
import { TEAM_COLORS } from "@/lib/colors";
import { DAMAGE_OFF_MESSAGE } from "@/lib/copy";
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
    return <p className="text-sm text-muted">{DAMAGE_OFF_MESSAGE}</p>;
  }
  if (initiation.fights.length === 0) return <p className="text-sm text-muted">No fights recorded.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">{summaryLine("ours", initiation.summary.ours, sides, initiation.fights.length)}</p>
      <p className="text-xs text-muted">{summaryLine("theirs", initiation.summary.theirs, sides, initiation.fights.length)}</p>
      <Table>
        <thead>
          <tr>
            <Th>Fight</Th>
            <Th>Engaged by</Th>
            <Th numeric>Lead on first kill</Th>
            <Th>Winner</Th>
          </tr>
        </thead>
        <tbody>
          {initiation.fights.map((f) => (
            <tr key={f.index}>
              <Td className="tabular-nums">{f.index}</Td>
              <Td style={{ color: f.initiator?.side ? TEAM_COLORS[f.initiator.side] : undefined }}>
                {f.initiator ? `${f.initiator.name} (${f.initiator.hero})` : <span className="text-muted">unknown</span>}
              </Td>
              <Td numeric className="tabular-nums">
                {f.secondsToFirstKill === null ? "–" : f.secondsToFirstKill < 0 ? `${Math.abs(f.secondsToFirstKill).toFixed(1)} s after` : `${f.secondsToFirstKill.toFixed(1)} s`}
              </Td>
              <Td style={{ color: f.winner ? TEAM_COLORS[f.winner] : undefined }}>{f.winner ? sides[f.winner] : "even"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="text-xs text-muted">A fight starts at its first kill; &quot;after&quot; means the first cross-team damage landed after it.</p>
    </div>
  );
}
