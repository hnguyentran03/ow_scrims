import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { parseRange, type SearchParams } from "@/lib/range";
import { heroPicks, ultEconomyByScrim, winRateByMap, winRateByType } from "@/lib/stats/trends";
import { Card } from "../card";
import { EmptyRange } from "../empty-range";
import { mapRecordRows, RecordTable, typeRecordRows } from "../record-table";
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
          <RecordTable head="Map" rows={mapRecordRows(byMap)} />
        </Card>
        <Card title="Win rate by map type">
          <RecordTable head="Map type" rows={typeRecordRows(byType)} />
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
