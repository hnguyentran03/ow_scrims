import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getScrim } from "@/lib/db/queries";
import { resultLabel } from "@/lib/format";
import { deleteMapAction, deleteScrimAction } from "@/app/actions";
import { AddMapForm } from "./add-map-form";
import { BansEditor } from "./bans-editor";

export const dynamic = "force-dynamic";

const BADGE: Record<"Won" | "Lost" | "N/A", string> = {
  Won: "bg-green-700",
  Lost: "bg-red-700",
  "N/A": "bg-zinc-700",
};

export default async function ScrimPage({ params }: { params: Promise<{ scrimId: string }> }) {
  const scrimId = Number((await params).scrimId);
  if (!Number.isInteger(scrimId)) notFound();
  const data = await getScrim(await getDb(), scrimId);
  if (!data) notFound();
  const { scrim, maps, bans } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-400 hover:underline">← Scrims</Link>
          <h1 className="text-2xl font-semibold">{scrim.name}</h1>
          <p className="text-zinc-400">{scrim.date} · vs {scrim.opponentName}</p>
        </div>
        <form action={deleteScrimAction.bind(null, scrim.id)}>
          <button type="submit" className="text-sm text-red-400 hover:underline">Delete scrim</button>
        </form>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {maps.map((m) => {
          const label = resultLabel(m);
          const ours = m.ourSide === 1 ? m.team1Score : m.team2Score;
          const theirs = m.ourSide === 1 ? m.team2Score : m.team1Score;
          return (
            <li key={m.id} className="rounded border border-zinc-800 p-4">
              <div className="flex items-center justify-between">
                <Link href={`/scrims/${scrim.id}/maps/${m.id}`} className="font-medium hover:underline">
                  {m.order}. {m.mapName}
                </Link>
                <span className={`rounded px-2 py-0.5 text-xs ${BADGE[label]}`}>{label}</span>
              </div>
              <p className="text-sm text-zinc-400">{m.mapType} · {m.mapType === "Push" ? "score N/A" : `${ours} - ${theirs}`}</p>
              <BansEditor scrimId={scrim.id} mapId={m.id} ourSide={m.ourSide} bans={bans.filter((b) => b.mapId === m.id)} />
              <form action={deleteMapAction.bind(null, scrim.id, m.id)} className="mt-2">
                <button type="submit" className="text-xs text-red-400 hover:underline">Delete map</button>
              </form>
            </li>
          );
        })}
      </ul>

      <AddMapForm scrimId={scrim.id} />
    </div>
  );
}
