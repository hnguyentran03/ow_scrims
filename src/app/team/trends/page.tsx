import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatPct } from "@/lib/format";
import { parseRange, type SearchParams } from "@/lib/range";
import { heroPicks, ultEconomyByScrim, winRateByMap, winRateByType } from "@/lib/stats/trends";
import { EmptyRange } from "../empty-range";
import { HeroPicksTable } from "./hero-picks-table";
import { UltEconomyChart } from "./ult-economy-chart";

export const dynamic = "force-dynamic";

export default async function TrendsPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await getTeamRows(await getDb(), parseRange(await searchParams), { ults: true, charged: true, playerStats: true, bans: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const byMap = winRateByMap(rows.maps);
  const byType = winRateByType(rows.maps);
  const ours = heroPicks(rows.maps, rows.playerStats, rows.bans, "ours");
  const theirs = heroPicks(rows.maps, rows.playerStats, rows.bans, "theirs");
  const economy = ultEconomyByScrim(rows.maps, rows.playerStats, rows.ultCharged, rows.ultStarts, rows.ultEnds);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Win rate by map">
          <RecordTable head="Map" rows={byMap.map((r) => ({ key: r.mapName, label: r.mapName, sub: r.mapType, ...r }))} />
        </Card>
        <Card title="Win rate by map type">
          <RecordTable head="Map type" rows={byType.map((r) => ({ key: r.mapType, label: r.mapType, ...r }))} />
        </Card>
      </div>
      <Card title="Hero picks" note="Pick % is over maps where the hero was not banned by either team.">
        <HeroPicksTable ours={ours} theirs={theirs} />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ults per 10 minutes" note="Our team, per scrim">
          <UltEconomyChart points={economy} kind="per10" />
        </Card>
        <Card title="Ult timing" note="Average seconds, our team, per scrim">
          <UltEconomyChart points={economy} kind="timing" />
        </Card>
      </div>
    </div>
  );
}

function RecordTable({ rows, head }: { rows: Array<{ key: string; label: string; sub?: string; played: number; won: number; lost: number; undecided: number; winRate: number | null }>, head: string }) {
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

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded border border-zinc-800 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {note && <span className="text-xs text-zinc-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}
