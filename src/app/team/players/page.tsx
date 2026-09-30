import Link from "next/link";
import { Card } from "@/components/card";
import { Table, Td, Th } from "@/components/table";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatDuration } from "@/lib/format";
import { parseRange, rangeQuery, type SearchParams } from "@/lib/range";
import { playerMapMatrix } from "@/lib/stats/player-map-matrix";
import { buildRoster } from "@/lib/stats/roster";
import { EmptyRange } from "../empty-range";
import { PlayerMapMatrixTable } from "./player-map-matrix-table";

export const dynamic = "force-dynamic";

export default async function PlayersPage({ searchParams }: { searchParams: SearchParams }) {
  const range = parseRange(await searchParams);
  const rows = await getTeamRows(await getDb(), range, { playerStats: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const roster = buildRoster(rows.maps, rows.playerStats);
  const matrix = playerMapMatrix(rows.maps, rows.playerStats);
  const href = (name: string) => `/team/players/${encodeURIComponent(name)}${rangeQuery(range)}`;

  return (
    <div className="space-y-6">
      <Card title="Roster" note="Everyone who played on our side in range. Click a name for their page.">
        <Table>
          <thead>
            <tr><Th>Player</Th><Th numeric>Maps</Th><Th numeric>Time</Th><Th>Main role</Th><Th>Top hero</Th></tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.name}>
                <Td><Link href={href(r.name)} className="hover:underline">{r.name}</Link></Td>
                <Td numeric>{r.maps}</Td>
                <Td numeric>{formatDuration(r.timePlayed)}</Td>
                <Td>{r.mainRole}</Td>
                <Td>{r.topHero}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <PlayerMapMatrixTable matrix={matrix} />
    </div>
  );
}
