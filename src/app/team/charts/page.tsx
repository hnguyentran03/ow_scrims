import { Card } from "@/components/card";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { parseRange, type SearchParams } from "@/lib/range";
import { buildScatterPoints } from "@/lib/stats/scatter";
import { EmptyRange } from "../empty-range";
import { ScatterChart } from "./scatter-chart";

export const dynamic = "force-dynamic";

export default async function ChartsPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await getTeamRows(await getDb(), parseRange(await searchParams), { playerStats: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const points = buildScatterPoints(rows.maps, rows.playerStats);
  return (
    <Card title="Scatter plot" note="One point per player per hero per map on our side, per 10 minutes of hero time, with at least three minutes on the hero.">
      <ScatterChart points={points} />
    </Card>
  );
}
