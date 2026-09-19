import { getCompareRows } from "@/lib/db/queries";
import { comparablePlayers } from "@/lib/stats/compare";
import { buildOverview } from "@/lib/stats/overview";
import { loadMap, type MapParams } from "../load-map";
import { ComparePanel } from "./compare-panel";

export const dynamic = "force-dynamic";

export default async function ComparePage({ params }: { params: MapParams }) {
  const { db, map, sides } = await loadMap(params);
  const { playerStats } = await getCompareRows(db, map.id);
  const { players } = buildOverview({ team1Name: map.team1Name, team2Name: map.team2Name, ourTeam: sides.ours, playerStats, kills: [] });
  return <ComparePanel players={players} options={comparablePlayers(players, sides)} sides={sides} />;
}
