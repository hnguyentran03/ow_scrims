import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getMap, getMapStats } from "@/lib/db/queries";
import { formatDuration, formatInt, resultLabel } from "@/lib/format";
import { buildOverview } from "@/lib/stats/overview";
import { StatTable } from "./stat-table";
import { WinnerControl } from "./winner-control";

export const dynamic = "force-dynamic";

const BADGE: Record<"Won" | "Lost" | "N/A", string> = { Won: "bg-green-700", Lost: "bg-red-700", "N/A": "bg-zinc-700" };

export default async function MapPage({ params }: { params: Promise<{ scrimId: string; mapId: string }> }) {
  const p = await params;
  const scrimId = Number(p.scrimId);
  const mapId = Number(p.mapId);
  if (!Number.isInteger(scrimId) || !Number.isInteger(mapId)) notFound();

  const db = await getDb();
  const data = await getMap(db, mapId);
  if (!data || data.scrim.id !== scrimId) notFound();
  const { map, scrim } = data;

  const { playerStats, kills } = await getMapStats(db, mapId);
  const ourTeam = map.ourSide === 1 ? map.team1Name : map.team2Name;
  const theirTeam = map.ourSide === 1 ? map.team2Name : map.team1Name;
  const overview = buildOverview({ team1Name: map.team1Name, team2Name: map.team2Name, ourTeam, playerStats, kills });
  const ours = overview.teamTotals.find((t) => t.team === ourTeam)!;
  const theirs = overview.teamTotals.find((t) => t.team === theirTeam)!;
  const ourScore = map.ourSide === 1 ? map.team1Score : map.team2Score;
  const theirScore = map.ourSide === 1 ? map.team2Score : map.team1Score;
  const label = resultLabel(map);
  const pct = (n: number | undefined) => `${Math.round((n ?? 0) * 100)}%`;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/scrims/${scrim.id}`} className="text-sm text-zinc-400 hover:underline">← {scrim.name}</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{map.mapName}</h1>
          <span className="text-zinc-400">{map.mapType}</span>
          <span className={`rounded px-2 py-0.5 text-xs ${BADGE[label]}`}>{label}</span>
        </div>
        <p className="text-sm text-zinc-400">{scrim.date} · {ourTeam} vs {theirTeam}</p>
        <WinnerControl scrimId={scrim.id} mapId={map.id} team1Name={map.team1Name} team2Name={map.team2Name} winnerSide={map.winnerSide} winnerSource={map.winnerSource} />
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Score" value={map.mapType === "Push" ? "N/A" : `${ourScore} - ${theirScore}`} />
        <Stat label="Match time" value={formatDuration(map.durationSeconds)} />
        <Stat label="Hero damage" value={`${formatInt(ours.heroDamage)} / ${formatInt(theirs.heroDamage)}`} hint={`${ourTeam} / ${theirTeam}`} />
        <Stat label="Healing" value={`${formatInt(ours.healing)} / ${formatInt(theirs.healing)}`} hint={`${ourTeam} / ${theirTeam}`} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Players</h2>
        <StatTable rows={overview.players} ourTeam={ourTeam} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Analysis</h2>
        <ul className="text-sm text-zinc-300">
          <li>Fights: {overview.analysis.fights}</li>
          <li>First death rate: {ourTeam} {pct(overview.analysis.firstDeathPct[ourTeam])} · {theirTeam} {pct(overview.analysis.firstDeathPct[theirTeam])}</li>
          <li>
            Most first deaths:{" "}
            {overview.analysis.mostFirstDeaths
              ? `${overview.analysis.mostFirstDeaths.name} (${overview.analysis.mostFirstDeaths.team}), ${overview.analysis.mostFirstDeaths.count}`
              : "none"}
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border border-zinc-800 p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
