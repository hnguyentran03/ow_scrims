import { notFound } from "next/navigation";
import { getMapImages, getReplayRows, listSameMapReplays } from "@/lib/db/queries";
import { REPLAY_ENABLED } from "@/lib/flags";
import { ghostOptions } from "@/lib/ghost";
import { calibratedImages } from "@/lib/map-images";
import type { SearchParams } from "@/lib/range";
import { parseTimeParam } from "@/lib/stats/playback";
import { buildReplay } from "@/lib/stats/replay";
import { stageWindows } from "@/lib/stats/stages";
import { loadMap, type MapParams } from "../load-map";
import { ReplayPanel } from "./replay-panel";

export const dynamic = "force-dynamic";

export default async function ReplayPage({ params, searchParams }: { params: MapParams; searchParams: SearchParams }) {
  if (!REPLAY_ENABLED) notFound();
  const { db, map, scrim, sides } = await loadMap(params);
  const rows = await getReplayRows(db, map.id);
  const images = calibratedImages(await getMapImages(db, map.mapName));
  const replay = buildReplay({ map, sides, rows, images });
  const initialTime = parseTimeParam((await searchParams).t, replay.durationSeconds);
  const others = replay.hasPositions
    ? (await listSameMapReplays(db, map.mapName, map.id)).map((pm) => ({
        mapId: pm.map.id,
        scrimName: pm.scrimName,
        scrimDate: pm.scrimDate,
        map: pm.map,
        stages: stageWindows({
          mapType: pm.map.mapType,
          roundStarts: pm.roundStarts,
          roundEnds: pm.roundEnds,
          objectiveUpdated: pm.objectiveUpdated,
          durationSeconds: pm.map.durationSeconds,
        }),
      }))
    : [];
  const ghostSources = replay.stages.map((_, i) =>
    ghostOptions({ mapId: map.id, stages: replay.stages, windowIndex: i }, others, { scrimName: scrim.name, scrimDate: scrim.date }),
  );
  return <ReplayPanel replay={replay} sides={sides} mapName={map.mapName} initialTime={initialTime} ghostSources={ghostSources} mapId={map.id} />;
}
