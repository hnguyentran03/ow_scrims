import Link from "next/link";
import { getDb } from "@/lib/db";
import { listScrims } from "@/lib/db/queries";
import { createScrimAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const scrims = await listScrims(await getDb());
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Scrims</h1>

      <form action={createScrimAction} className="flex flex-wrap items-end gap-3 rounded border border-zinc-800 p-4">
        <label className="flex flex-col text-sm">
          Name
          <input name="name" required className="rounded bg-zinc-900 px-2 py-1" placeholder="vs Cerberus" />
        </label>
        <label className="flex flex-col text-sm">
          Date
          <input name="date" type="date" required className="rounded bg-zinc-900 px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">
          Opponent
          <input name="opponentName" required className="rounded bg-zinc-900 px-2 py-1" />
        </label>
        <button type="submit" className="rounded bg-orange-500 px-3 py-1 font-medium text-black">Create scrim</button>
      </form>

      {scrims.length === 0 ? (
        <p className="text-zinc-400">No scrims yet. Create one above, then upload a map log.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded border border-zinc-800">
          {scrims.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/scrims/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
              <span className="text-sm text-zinc-400">{s.date} · vs {s.opponentName} · {s.mapCount} maps · {s.wins}-{s.losses}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
