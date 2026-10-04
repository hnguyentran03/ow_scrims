import { Suspense } from "react";
import { Badge } from "@/components/badge";
import { PageHeader } from "@/components/page-header";
import { Scoreboard } from "@/components/scoreboard";
import { resultLabel, scoreKnown } from "@/lib/format";
import { resultTone } from "@/lib/result";
import { loadMap, type MapParams } from "./load-map";
import { MapTabs } from "./map-tabs";
import { WinnerControl } from "./winner-control";

export const dynamic = "force-dynamic";

export default async function MapLayout({ children, params }: { children: React.ReactNode; params: MapParams }) {
  const { map, scrim, sides, bans } = await loadMap(params);
  const label = resultLabel(map);
  const ourScore = map.ourSide === 1 ? map.team1Score : map.team2Score;
  const theirScore = map.ourSide === 1 ? map.team2Score : map.team1Score;
  const score = (n: number) => (scoreKnown(map) ? String(n) : "N/A");
  const bansFor = (ours: boolean) => bans.filter((b) => (b.side === map.ourSide) === ours).map((b) => b.hero).join(", ") || "none";
  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/scrims/${scrim.id}`, label: scrim.name }}
        title={map.mapName}
        meta={[scrim.date, map.mapType]}
        actions={<Badge tone={resultTone(label)}>{label}</Badge>}
      >
        <Scoreboard ours={{ name: sides.ours, score: score(ourScore) }} theirs={{ name: sides.theirs, score: score(theirScore) }}>
          {bans.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Our bans: {bansFor(true)}</span>
              <span>Their bans: {bansFor(false)}</span>
            </div>
          )}
          <WinnerControl scrimId={scrim.id} mapId={map.id} team1Name={map.team1Name} team2Name={map.team2Name} winnerSide={map.winnerSide} winnerSource={map.winnerSource} />
        </Scoreboard>
      </PageHeader>
      <Suspense fallback={null}>
        <MapTabs base={`/scrims/${scrim.id}/maps/${map.id}`} />
      </Suspense>
      {children}
    </div>
  );
}
