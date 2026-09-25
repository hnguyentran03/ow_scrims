import { Stat } from "@/components/stat";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatPct } from "@/lib/format";
import { parseRange, type SearchParams } from "@/lib/range";
import { buildTeamOverview, MIN_MAP_PLAYS, type ModeExtremes } from "@/lib/stats/team-overview";
import type { MapRecord, TypeRecord } from "@/lib/stats/trends";
import { EmptyRange } from "./empty-range";

export const dynamic = "force-dynamic";

export default async function TeamOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await getTeamRows(await getDb(), parseRange(await searchParams), { playerStats: true });
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
        <TypeCard title="Strongest game mode" record={o.strongestType} />
        <TypeCard title="Blind spot game mode" record={o.blindSpotType} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MapCard title="Strongest map" record={o.strongest} />
        <MapCard title="Blind spot map" record={o.blindSpot} />
      </div>

      <ByModeTable rows={o.byMode} />

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

function ByModeTable({ rows }: { rows: ModeExtremes[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">By game mode</h2>
      <p className="text-xs text-zinc-500">Strongest and blind-spot map within each mode, among maps played at least {MIN_MAP_PLAYS} times.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr><th className="py-1">Mode</th><th>Played</th><th>Strongest map</th><th>Blind spot map</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mapType} className="border-t border-zinc-800 tabular-nums">
              <td className="py-1">{r.mapType}</td>
              <td>{r.played}</td>
              <ModeMapCell record={r.strongest} />
              <ModeMapCell record={r.blindSpot} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ModeMapCell({ record }: { record: MapRecord | null }) {
  if (!record) return <td className="text-zinc-500">Needs {MIN_MAP_PLAYS} plays of a map</td>;
  return (
    <td>
      <span className="font-medium">{record.mapName}</span>
      <span className="text-zinc-400"> · {record.won}-{record.lost} · {formatPct(record.winRate)}</span>
    </td>
  );
}

function TypeCard({ title, record }: { title: string; record: TypeRecord | null }) {
  return (
    <section className="rounded border border-zinc-800 p-4">
      <h2 className="text-xs uppercase tracking-wide text-zinc-500">{title}</h2>
      {record ? (
        <>
          <div className="text-lg font-semibold">{record.mapType}</div>
          <div className="text-sm text-zinc-400">{record.played} played · {record.won}-{record.lost} · {formatPct(record.winRate)}</div>
        </>
      ) : (
        <p className="text-sm text-zinc-400">Play a game mode at least {MIN_MAP_PLAYS} times to see this.</p>
      )}
    </section>
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
