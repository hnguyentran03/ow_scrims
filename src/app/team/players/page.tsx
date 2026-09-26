import Link from "next/link";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatDuration } from "@/lib/format";
import { parseRange, rangeQuery, type SearchParams } from "@/lib/range";
import { buildRoster } from "@/lib/stats/roster";
import { EmptyRange } from "../empty-range";

export const dynamic = "force-dynamic";

export default async function PlayersPage({ searchParams }: { searchParams: SearchParams }) {
  const range = parseRange(await searchParams);
  const rows = await getTeamRows(await getDb(), range, { playerStats: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const roster = buildRoster(rows.maps, rows.playerStats);
  const href = (name: string) => `/team/players/${encodeURIComponent(name)}${rangeQuery(range)}`;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">Roster</h2>
      <p className="text-xs text-zinc-500">Everyone who played on our side in range. Click a name for their page.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr><th className="py-1">Player</th><th>Maps</th><th>Time</th><th>Main role</th><th>Top hero</th></tr>
        </thead>
        <tbody>
          {roster.map((r) => (
            <tr key={r.name} className="border-t border-zinc-800 tabular-nums">
              <td className="py-1"><Link href={href(r.name)} className="hover:underline">{r.name}</Link></td>
              <td>{r.maps}</td><td>{formatDuration(r.timePlayed)}</td><td>{r.mainRole}</td><td>{r.topHero}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
