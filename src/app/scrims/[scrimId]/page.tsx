import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getDb } from "@/lib/db";
import { getScrim } from "@/lib/db/queries";
import { resultLabel, scoreKnown } from "@/lib/format";
import { parsePositiveInt } from "@/lib/ids";
import { resultTone } from "@/lib/result";
import { deleteMapAction, deleteScrimAction } from "@/app/actions";
import { AddMapForm } from "./add-map-form";
import { BansEditor } from "./bans-editor";

export const dynamic = "force-dynamic";

export default async function ScrimPage({ params }: { params: Promise<{ scrimId: string }> }) {
  const scrimId = parsePositiveInt((await params).scrimId);
  if (scrimId === null) notFound();
  const data = await getScrim(await getDb(), scrimId);
  if (!data) notFound();
  const { scrim, maps, bans } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/", label: "Scrims" }}
        title={scrim.name}
        meta={[scrim.date, `vs ${scrim.opponentName}`]}
        actions={
          <form action={deleteScrimAction.bind(null, scrim.id)}>
            <Button type="submit" variant="danger">Delete scrim</Button>
          </form>
        }
      />

      {maps.length === 0 ? (
        <EmptyState>No maps yet. Drop this scrim&apos;s log files below.</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((m) => {
            const label = resultLabel(m);
            const ours = m.ourSide === 1 ? m.team1Score : m.team2Score;
            const theirs = m.ourSide === 1 ? m.team2Score : m.team1Score;
            return (
              <li key={m.id} className="space-y-2 rounded-card border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/scrims/${scrim.id}/maps/${m.id}`} className="font-medium hover:underline">
                    {m.order}. {m.mapName}
                  </Link>
                  <Badge tone={resultTone(label)}>{label}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-3 text-sm text-muted">
                  <span>{m.mapType}</span>
                  <span className="text-ink">{scoreKnown(m) ? `${ours} - ${theirs}` : "score N/A"}</span>
                </div>
                <BansEditor scrimId={scrim.id} mapId={m.id} ourSide={m.ourSide} bans={bans.filter((b) => b.mapId === m.id)} />
                <form action={deleteMapAction.bind(null, scrim.id, m.id)}>
                  <Button type="submit" variant="danger" size="sm">Delete map</Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <Card title="Add maps">
        <AddMapForm scrimId={scrim.id} />
      </Card>
    </div>
  );
}
