import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getMapImages, getReplayRows } from "@/lib/db/queries";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import { parseHeatmapFilters, playerKey } from "@/lib/heatmap-filters";
import { calibratedImages } from "@/lib/map-images";
import { stageHref } from "@/lib/map-images-href";
import type { SearchParams } from "@/lib/range";
import { groupFights } from "@/lib/stats/fights";
import { buildHeatmap } from "@/lib/stats/heatmap";
import { buildReplay } from "@/lib/stats/replay";
import { buildTerritory, objectiveFromCalibration } from "@/lib/stats/territory";
import { loadMap, type MapParams } from "../load-map";
import { NO_POSITIONS } from "../stage-canvas";
import { HeatmapFilters } from "./heatmap-filters";
import { HeatmapPanel } from "./heatmap-panel";

export const dynamic = "force-dynamic";

export default async function HeatmapPage({ params, searchParams }: { params: MapParams; searchParams: SearchParams }) {
  if (!POSITION_FEATURES_ENABLED) notFound();
  const { db, map, sides } = await loadMap(params);
  const rows = await getReplayRows(db, map.id);
  const imageRows = await getMapImages(db, map.mapName);
  const images = calibratedImages(imageRows);
  const replay = buildReplay({ map, sides, rows, images });
  if (!replay.hasPositions) {
    return <p className="text-sm text-muted">{NO_POSITIONS}</p>;
  }
  const filter = parseHeatmapFilters(await searchParams, replay);
  const fights = groupFights(rows.kills);
  const heatmap = buildHeatmap({ replay, sides, rows, fights, filter });
  const stage = replay.stages[filter.stage];
  const imageRow = imageRows.find((i) => i.stage === stage.stage) ?? null;
  const objective = objectiveFromCalibration(imageRow?.calibration ?? null);
  const territory = buildTerritory({ replay, stage: filter.stage, fights, objective });
  const stageOptions = replay.stages.map((s, index) => ({ index, label: s.label }));
  const playerOptions = replay.players.map((p) => ({ key: playerKey(p), label: p.name, side: p.side }));
  const fightOptions = fights.filter((f) => f.start >= stage.start && f.start <= stage.end).map((f) => ({ index: f.index, start: f.start }));

  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <HeatmapFilters stages={stageOptions} players={playerOptions} filter={filter} sides={sides} />
      </Suspense>
      <HeatmapPanel heatmap={heatmap} stage={stage} sides={sides} fights={fightOptions} hasPositions={replay.hasPositions} filterSide={filter.side} territory={territory} objectiveHref={stageHref(map.mapName, stage.stage)} />
    </div>
  );
}
