import Link from "next/link";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatDuration, formatInt } from "@/lib/format";
import { parseRange, rangeQuery, type SearchParams } from "@/lib/range";
import { buildLeaderboard, buildRoster, type Board } from "@/lib/stats/leaderboard";
import { EmptyRange } from "../empty-range";

export const dynamic = "force-dynamic";

export default async function PlayersPage({ searchParams }: { searchParams: SearchParams }) {
  const range = parseRange(await searchParams);
  const rows = await getTeamRows(await getDb(), range, { playerStats: true, kills: true, ults: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const roster = buildRoster(rows.maps, rows.playerStats);
  const lb = buildLeaderboard(rows.maps, rows.playerStats, rows.kills, rows.ultEnds);
  const href = (name: string) => `/team/players/${encodeURIComponent(name)}${rangeQuery(range)}`;

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Leaderboard</h2>
        <p className="text-xs text-zinc-500">Players with at least {lb.minSeconds / 60} minutes in range ({lb.eligibleCount} qualify).</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {lb.boards.map((b) => (
            <BoardCard key={b.key} board={b} href={href} />
          ))}
          <div className="rounded border border-zinc-800 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Most played heroes</div>
            {lb.mostPlayedHeroes.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">No one yet</p>
            ) : (
              <ol className="mt-1 space-y-1 text-sm tabular-nums">
                {lb.mostPlayedHeroes.map((h, i) => (
                  <li key={h.hero} className="flex justify-between gap-2">
                    <span><span className="mr-2 text-zinc-500">{i + 1}</span>{h.hero}<span className="ml-2 text-xs text-zinc-500">{h.role}</span></span>
                    <span>{formatDuration(h.playtime)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Roster</h2>
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
    </div>
  );
}

function formatBoard(unit: Board["unit"], v: number): string {
  if (unit === "seconds") return formatDuration(v);
  if (unit === "count") return String(v);
  return v >= 100 ? formatInt(v) : v.toFixed(1);
}

function BoardCard({ board, href }: { board: Board; href: (name: string) => string }) {
  return (
    <div className="rounded border border-zinc-800 p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{board.label}</div>
      {board.entries.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-500">No one yet</p>
      ) : (
        <ol className="mt-1 space-y-1 text-sm tabular-nums">
          {board.entries.map((e, i) => (
            <li key={e.name} className="flex justify-between gap-2">
              <span><span className="mr-2 text-zinc-500">{i + 1}</span><Link href={href(e.name)} className="hover:underline">{e.name}</Link></span>
              <span>{formatBoard(board.unit, e.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
