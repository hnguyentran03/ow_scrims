import { Stat } from "@/components/stat";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatPct } from "@/lib/format";
import { parseRange, type SearchParams } from "@/lib/range";
import { buildTeamOverview, MIN_MAP_PLAYS } from "@/lib/stats/team-overview";
import type { MapRecord } from "@/lib/stats/trends";
import { EmptyRange } from "./empty-range";

export const dynamic = "force-dynamic";

export default async function TeamOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await getTeamRows(await getDb(), parseRange(await searchParams));
  if (rows.maps.length === 0) return <EmptyRange />;
  const o = buildTeamOverview(rows.maps, rows.playerStats);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Record" value={`${o.record.won}-${o.record.lost}`} hint={`${o.record.undecided} undecided`} />
        <Stat label="Last 10" value={`${o.lastTen.won}-${o.lastTen.lost}`} hint="decided maps" />
        <Stat label="Maps" value={String(o.record.maps)} />
        <Stat label="Scrims" value={String(o.record.scrims)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MapCard title="Strongest map" record={o.strongest} />
        <MapCard title="Blind spot" record={o.blindSpot} />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Role balance</h2>
        <p className="text-xs text-zinc-500">Our share of team totals by role.</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="py-1">Role</th><th>Final blows</th><th>Deaths</th><th>Hero damage</th><th>Healing</th></tr>
          </thead>
          <tbody>
            {o.roleBalance.map((r) => (
              <tr key={r.role} className="border-t border-zinc-800 tabular-nums">
                <td className="py-1">{r.role}</td><td>{formatPct(r.finalBlows)}</td><td>{formatPct(r.deaths)}</td><td>{formatPct(r.heroDamage)}</td><td>{formatPct(r.healing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MapCard({ title, record }: { title: string; record: MapRecord | null }) {
  return (
    <section className="rounded border border-zinc-800 p-4">
      <h2 className="text-xs uppercase tracking-wide text-zinc-500">{title}</h2>
      {record ? (
        <>
          <div className="text-lg font-semibold">{record.mapName}</div>
          <div className="text-sm text-zinc-400">{record.mapType} · {record.played} played · {record.won}-{record.lost} · {formatPct(record.winRate)}</div>
        </>
      ) : (
        <p className="text-sm text-zinc-400">Play a map at least {MIN_MAP_PLAYS} times to see this.</p>
      )}
    </section>
  );
}
