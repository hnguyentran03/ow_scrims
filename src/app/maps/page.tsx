import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Table, Td, Th } from "@/components/table";
import { getDb } from "@/lib/db";
import { POSITION_FEATURES_ENABLED } from "@/lib/flags";
import { listStagesSeen } from "@/lib/db/queries";
import { stageHref } from "@/lib/map-images-href";
import { stageLabel } from "@/lib/stats/stages";

export const dynamic = "force-dynamic";

export default async function MapsPage() {
  if (!POSITION_FEATURES_ENABLED) notFound();
  const stages = await listStagesSeen(await getDb());
  return (
    <div className="space-y-4">
      <PageHeader title="Maps" />
      <p className="text-sm text-muted">One top-down image per map stage, calibrated against a log with position logging on. Stages appear here once a scrim log for that map has been uploaded.</p>
      {stages.length === 0 ? (
        <EmptyState>No scrim logs uploaded yet.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Map</Th>
              <Th>Stage</Th>
              <Th>Mode</Th>
              <Th numeric>Maps played</Th>
              <Th>Image</Th>
              <Th>Calibrated</Th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={`${s.mapName}|${s.stage}`}>
                <Td><Link href={stageHref(s.mapName, s.stage)} className="hover:underline">{s.mapName}</Link></Td>
                <Td>{stageLabel(s, s.stage)}</Td>
                <Td muted>{s.mapType}</Td>
                <Td numeric>{s.mapsPlayed}</Td>
                <Td>{s.image ? "yes" : "no"}</Td>
                <Td>{s.image?.calibrated ? "yes" : "no"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
