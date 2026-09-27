import { notFound } from "next/navigation";
import { getReplayRows } from "@/lib/db/queries";
import { REPLAY_ENABLED } from "@/lib/flags";
import type { SearchParams } from "@/lib/range";
import { parseTimeParam } from "@/lib/stats/playback";
import { buildReplay } from "@/lib/stats/replay";
import { loadMap, type MapParams } from "../load-map";
import { ReplayPanel } from "./replay-panel";

export const dynamic = "force-dynamic";

export default async function ReplayPage({ params, searchParams }: { params: MapParams; searchParams: SearchParams }) {
  if (!REPLAY_ENABLED) notFound();
  const { db, map, sides } = await loadMap(params);
  const rows = await getReplayRows(db, map.id);
  const replay = buildReplay({ map, sides, rows, images: [] });
  const initialTime = parseTimeParam((await searchParams).t, replay.durationSeconds);
  return <ReplayPanel replay={replay} sides={sides} mapName={map.mapName} initialTime={initialTime} />;
}
