import { getMapStats } from "@/lib/db/queries";
import { formatDuration, formatInt, scoreKnown } from "@/lib/format";
import { findAjaxes } from "@/lib/stats/events";
import { killKind } from "@/lib/stats/fights";
import { buildOverview } from "@/lib/stats/overview";
import { loadMap, type MapParams } from "./load-map";
import { Stat } from "@/components/stat";
import { StatTable } from "./stat-table";
import { Card } from "@/components/card";
import { Table, Td } from "@/components/table";

export const dynamic = "force-dynamic";

export default async function MapPage({ params }: { params: MapParams }) {
  const { db, map, sides } = await loadMap(params);
  const { playerStats, kills, ultimateEnds } = await getMapStats(db, map.id);
  const overview = buildOverview({ team1Name: map.team1Name, team2Name: map.team2Name, ourTeam: sides.ours, playerStats, kills });
  const ours = overview.teamTotals.find((t) => t.team === sides.ours)!;
  const theirs = overview.teamTotals.find((t) => t.team === sides.theirs)!;
  const ourScore = map.ourSide === 1 ? map.team1Score : map.team2Score;
  const theirScore = map.ourSide === 1 ? map.team2Score : map.team1Score;
  const pct = (n: number | undefined) => `${Math.round((n ?? 0) * 100)}%`;
  const ultKills = (team: string) => kills.filter((k) => k.attackerTeam === team && k.eventAbility === "Ultimate" && killKind(k) === "kill").length;
  const ajaxes = findAjaxes(kills, ultimateEnds);
  const ajaxCount = (team: string) => ajaxes.filter((a) => a.team === team).length;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Score" value={scoreKnown(map) ? `${ourScore} - ${theirScore}` : "N/A"} />
        <Stat label="Match time" value={formatDuration(map.durationSeconds)} />
        <Stat label="Hero damage" value={`${formatInt(ours.heroDamage)} / ${formatInt(theirs.heroDamage)}`} hint={`${sides.ours} / ${sides.theirs}`} />
        <Stat label="Healing" value={`${formatInt(ours.healing)} / ${formatInt(theirs.healing)}`} hint={`${sides.ours} / ${sides.theirs}`} />
      </section>

      <Card title="Players">
        <StatTable rows={overview.players} ourTeam={sides.ours} />
      </Card>

      <Card title="Analysis">
        <Table>
          <tbody>
            <tr><Td muted>Fights</Td><Td numeric>{overview.analysis.fights}</Td></tr>
            <tr><Td muted>First death rate</Td><Td numeric>{sides.ours} {pct(overview.analysis.firstDeathPct[sides.ours])} / {sides.theirs} {pct(overview.analysis.firstDeathPct[sides.theirs])}</Td></tr>
            <tr>
              <Td muted>Most first deaths</Td>
              <Td numeric>{overview.analysis.mostFirstDeaths ? `${overview.analysis.mostFirstDeaths.name} (${overview.analysis.mostFirstDeaths.team}), ${overview.analysis.mostFirstDeaths.count}` : "none"}</Td>
            </tr>
            <tr><Td muted>Ultimate value (final blows with ults)</Td><Td numeric>{sides.ours} {ultKills(sides.ours)} / {sides.theirs} {ultKills(sides.theirs)}</Td></tr>
            <tr><Td muted>Ajaxes (Lúcio died mid-ult)</Td><Td numeric>{sides.ours} {ajaxCount(sides.ours)} / {sides.theirs} {ajaxCount(sides.theirs)}</Td></tr>
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
