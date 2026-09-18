import Link from "next/link";
import { resultLabel } from "@/lib/format";
import { loadMap, type MapParams } from "./load-map";
import { MapTabs } from "./map-tabs";
import { WinnerControl } from "./winner-control";

export const dynamic = "force-dynamic";

const BADGE: Record<"Won" | "Lost" | "N/A", string> = { Won: "bg-green-700", Lost: "bg-red-700", "N/A": "bg-zinc-700" };

export default async function MapLayout({ children, params }: { children: React.ReactNode; params: MapParams }) {
  const { map, scrim, sides } = await loadMap(params);
  const label = resultLabel(map);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={`/scrims/${scrim.id}`} className="text-sm text-zinc-400 hover:underline">← {scrim.name}</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{map.mapName}</h1>
          <span className="text-zinc-400">{map.mapType}</span>
          <span className={`rounded px-2 py-0.5 text-xs ${BADGE[label]}`}>{label}</span>
        </div>
        <p className="text-sm text-zinc-400">{scrim.date} · {sides.ours} vs {sides.theirs}</p>
        <WinnerControl scrimId={scrim.id} mapId={map.id} team1Name={map.team1Name} team2Name={map.team2Name} winnerSide={map.winnerSide} winnerSource={map.winnerSource} />
      </header>
      <MapTabs base={`/scrims/${scrim.id}/maps/${map.id}`} />
      {children}
    </div>
  );
}
