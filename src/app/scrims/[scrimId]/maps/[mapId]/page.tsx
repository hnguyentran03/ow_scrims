import { getMapStats } from "@/lib/db/queries";
import { formatDuration, formatInt } from "@/lib/format";
import { findAjaxes } from "@/lib/stats/events";
import { killKind } from "@/lib/stats/fights";
import { buildOverview } from "@/lib/stats/overview";
import { loadMap, type MapParams } from "./load-map";
import { Stat } from "./stat";
import { StatTable } from "./stat-table";

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
        <Stat label="Score" value={map.mapType === "Push" ? "N/A" : `${ourScore} - ${theirScore}`} />
        <Stat label="Match time" value={formatDuration(map.durationSeconds)} />
        <Stat label="Hero damage" value={`${formatInt(ours.heroDamage)} / ${formatInt(theirs.heroDamage)}`} hint={`${sides.ours} / ${sides.theirs}`} />
        <Stat label="Healing" value={`${formatInt(ours.healing)} / ${formatInt(theirs.healing)}`} hint={`${sides.ours} / ${sides.theirs}`} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Players</h2>
        <StatTable rows={overview.players} ourTeam={sides.ours} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Analysis</h2>
        <ul className="text-sm text-zinc-300">
          <li>Fights: {overview.analysis.fights}</li>
          <li>First death rate: {sides.ours} {pct(overview.analysis.firstDeathPct[sides.ours])} · {sides.theirs} {pct(overview.analysis.firstDeathPct[sides.theirs])}</li>
          <li>
            Most first deaths:{" "}
            {overview.analysis.mostFirstDeaths
              ? `${overview.analysis.mostFirstDeaths.name} (${overview.analysis.mostFirstDeaths.team}), ${overview.analysis.mostFirstDeaths.count}`
              : "none"}
          </li>
          <li>Ultimate value (kills with ults): {sides.ours} {ultKills(sides.ours)} · {sides.theirs} {ultKills(sides.theirs)}</li>
          <li>Ajaxes (Lúcio died mid-ult): {sides.ours} {ajaxCount(sides.ours)} · {sides.theirs} {ajaxCount(sides.theirs)}</li>
        </ul>
      </section>
    </div>
  );
}
