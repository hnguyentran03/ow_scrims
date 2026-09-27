import { Suspense } from "react";
import { getReplayRows } from "@/lib/db/queries";
import { parseHeatmapFilters, playerKey } from "@/lib/heatmap-filters";
import type { SearchParams } from "@/lib/range";
import { groupFights } from "@/lib/stats/fights";
import { buildHeatmap } from "@/lib/stats/heatmap";
import { buildReplay } from "@/lib/stats/replay";
import { loadMap, type MapParams } from "../load-map";
import { NO_POSITIONS } from "../stage-canvas";
import { HeatmapFilters } from "./heatmap-filters";
import { HeatmapPanel } from "./heatmap-panel";

export const dynamic = "force-dynamic";

export default async function HeatmapPage({ params, searchParams }: { params: MapParams; searchParams: SearchParams }) {
  const { db, map, sides } = await loadMap(params);
  const rows = await getReplayRows(db, map.id);
  const replay = buildReplay({ map, sides, rows, images: [] });
  if (!replay.hasPositions) {
    return <p className="text-sm text-zinc-400">{NO_POSITIONS}</p>;
  }
  const filter = parseHeatmapFilters(await searchParams, replay);
  const fights = groupFights(rows.kills);
  const heatmap = buildHeatmap({ replay, sides, rows, fights, filter });
  const stage = replay.stages[filter.stage];
  const stageOptions = replay.stages.map((s, index) => ({ index, label: s.label }));
  const playerOptions = replay.players.map((p) => ({ key: playerKey(p), label: p.name, side: p.side }));
  const fightOptions = fights.filter((f) => f.start >= stage.start && f.start <= stage.end).map((f) => ({ index: f.index, start: f.start }));

  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <HeatmapFilters stages={stageOptions} players={playerOptions} filter={filter} sides={sides} />
      </Suspense>
      <HeatmapPanel heatmap={heatmap} stage={stage} sides={sides} fights={fightOptions} hasPositions={replay.hasPositions} filterSide={filter.side} />
    </div>
  );
}
