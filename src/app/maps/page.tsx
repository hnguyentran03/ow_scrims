import Link from "next/link";
import { getDb } from "@/lib/db";
import { listStagesSeen } from "@/lib/db/queries";
import { stageHref } from "@/lib/map-images-href";
import { stageLabel } from "@/lib/stats/stages";

export const dynamic = "force-dynamic";

export default async function MapsPage() {
  const stages = await listStagesSeen(await getDb());
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Maps</h1>
      <p className="text-sm text-zinc-400">One top-down image per map stage, calibrated against a log with position logging on. Stages appear here once a scrim log for that map has been uploaded.</p>
      {stages.length === 0 ? (
        <p className="text-sm text-zinc-400">No scrim logs uploaded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="py-1 text-left">Map</th><th className="text-left">Stage</th><th className="text-left">Mode</th><th className="text-right">Maps played</th><th className="text-left">Image</th><th className="text-left">Calibrated</th></tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={`${s.mapName}|${s.stage}`} className="border-t border-zinc-800">
                <td className="py-1"><Link href={stageHref(s.mapName, s.stage)} className="hover:underline">{s.mapName}</Link></td>
                <td>{stageLabel(s, s.stage)}</td>
                <td className="text-zinc-400">{s.mapType}</td>
                <td className="text-right tabular-nums">{s.mapsPlayed}</td>
                <td>{s.image ? "yes" : "no"}</td>
                <td>{s.image?.calibrated ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
