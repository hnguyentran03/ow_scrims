import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMapImageAction } from "@/app/actions";
import { getDb } from "@/lib/db";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import { getKillfeedRows, getMapImages, listPositionedStages, listStagesSeen } from "@/lib/db/queries";
import { nameCandidates } from "@/lib/player-name";
import { parseCalibration } from "@/lib/stats/calibration";
import { parsePosition } from "@/lib/stats/positions";
import { stageLabel, stageWindows } from "@/lib/stats/stages";
import { Calibrate, type CloudPoint } from "./calibrate";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function StagePage({ params }: { params: Promise<{ mapName: string; stage: string }> }) {
  if (!POSITION_FEATURES_ENABLED) notFound();
  const p = await params;
  const candidates = nameCandidates(p.mapName);
  if (!/^\d{1,3}$/.test(p.stage)) notFound();
  const stage = Number(p.stage);
  const db = await getDb();
  const seen = (await listStagesSeen(db)).find((s) => candidates.includes(s.mapName) && s.stage === stage);
  if (!seen) notFound();
  const mapName = seen.mapName;
  const image = (await getMapImages(db, mapName)).find((i) => i.stage === stage) ?? null;
  const calibration = image ? parseCalibration(image.calibration) : null;

  // The point cloud: kills inside this stage's windows on the newest map with positions.
  let points: CloudPoint[] = [];
  let sourceLabel: string | null = null;
  for (const pm of await listPositionedStages(db, mapName)) {
    const windows = stageWindows({ mapType: pm.map.mapType, roundStarts: pm.roundStarts, roundEnds: pm.roundEnds, objectiveUpdated: pm.objectiveUpdated, durationSeconds: pm.map.durationSeconds }).filter((w) => w.stage === stage);
    if (windows.length === 0) continue;
    const { kills } = await getKillfeedRows(db, pm.map.id);
    for (const k of kills) {
      const pos = parsePosition(k.victimPosition);
      if (pos && windows.some((w) => k.matchTime >= w.start && k.matchTime <= w.end)) points.push({ t: k.matchTime, attacker: k.attackerName, victim: k.victimName, x: pos.x, z: pos.z });
    }
    if (points.length > 0) {
      sourceLabel = `${pm.scrimName} · ${pm.scrimDate}`;
      break;
    }
    points = [];
  }

  return (
    <div className="space-y-6">
      <Link href="/maps" className="text-sm text-zinc-400 hover:underline">← Maps</Link>
      <h1 className="text-2xl font-semibold">{mapName} · {stageLabel(seen, stage)}</h1>
      <section className="space-y-2 rounded border border-zinc-800 p-4">
        <h2 className="text-lg font-medium">Image</h2>
        <UploadForm mapName={mapName} stage={stage} />
        {image && (
          <form action={deleteMapImageAction.bind(null, image.id)}>
            <button type="submit" className="text-sm text-red-400 hover:underline">Delete image and calibration</button>
          </form>
        )}
      </section>
      {image ? (
        <Calibrate key={image.id} imageId={image.id} calibration={calibration} points={points} sourceLabel={sourceLabel} />
      ) : (
        <p className="text-sm text-zinc-400">Upload a top-down image of this stage to calibrate it.</p>
      )}
    </div>
  );
}
