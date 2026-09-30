import { Card } from "@/components/card";
import { Stat } from "@/components/stat";
import { Table, Td, Th } from "@/components/table";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatPct } from "@/lib/format";
import { parseRange, type SearchParams } from "@/lib/range";
import { buildPerformance } from "@/lib/stats/performance";
import { buildTeamOverview, MIN_MAP_PLAYS, type ModeExtremes } from "@/lib/stats/team-overview";
import type { MapRecord, TypeRecord } from "@/lib/stats/trends";
import { EmptyRange } from "./empty-range";
import { RoleCards, TriosTable } from "./performance-cards";

export const dynamic = "force-dynamic";

export default async function TeamOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await getTeamRows(await getDb(), parseRange(await searchParams), { playerStats: true, kills: true, ults: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const o = buildTeamOverview(rows.maps, rows.playerStats);
  const perf = buildPerformance(rows.maps, rows.playerStats, rows.kills, rows.ultStarts, rows.ultEnds);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Record" value={`${o.record.won}-${o.record.lost}`} hint={`${o.record.undecided} undecided`} />
        <Stat label="Last 10" value={`${o.lastTen.won}-${o.lastTen.lost}`} hint="decided maps" />
        <Stat label="Maps" value={String(o.record.maps)} />
        <Stat label="Scrims" value={String(o.record.scrims)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TypeCard title="Strongest game mode" record={o.strongestType} />
        <TypeCard title="Blind spot game mode" record={o.blindSpotType} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MapCard title="Strongest map" record={o.strongest} />
        <MapCard title="Blind spot map" record={o.blindSpot} />
      </div>

      <ByModeTable rows={o.byMode} />

      <Card title="Role balance" note="Our share of team totals by role.">
        <Table>
          <thead>
            <tr><Th>Role</Th><Th numeric>Final blows</Th><Th numeric>Deaths</Th><Th numeric>Hero damage</Th><Th numeric>Healing</Th></tr>
          </thead>
          <tbody>
            {o.roleBalance.map((r) => (
              <tr key={r.role}>
                <Td>{r.role}</Td>
                <Td numeric>{formatPct(r.finalBlows)}</Td>
                <Td numeric>{formatPct(r.deaths)}</Td>
                <Td numeric>{formatPct(r.heroDamage)}</Td>
                <Td numeric>{formatPct(r.healing)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <RoleCards roles={perf.roles} />
      <TriosTable trios={perf.trios} />
    </div>
  );
}

function ByModeTable({ rows }: { rows: ModeExtremes[] }) {
  return (
    <Card title="By game mode" note={`Strongest and blind-spot map within each mode, among maps played at least ${MIN_MAP_PLAYS} times.`}>
      <Table>
        <thead>
          <tr><Th>Mode</Th><Th numeric>Played</Th><Th>Strongest map</Th><Th>Blind spot map</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mapType}>
              <Td>{r.mapType}</Td>
              <Td numeric>{r.played}</Td>
              <ModeMapCell record={r.strongest} />
              <ModeMapCell record={r.blindSpot} />
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function ModeMapCell({ record }: { record: MapRecord | null }) {
  if (!record) return <Td muted>Needs {MIN_MAP_PLAYS} plays of a map</Td>;
  return (
    <Td>
      <span className="font-medium">{record.mapName}</span>
      <span className="ml-2 text-muted">{record.won}-{record.lost}, {formatPct(record.winRate)}</span>
    </Td>
  );
}

function TypeCard({ title, record }: { title: string; record: TypeRecord | null }) {
  return (
    <Card title={title}>
      {record ? (
        <div className="space-y-1">
          <div className="text-lg font-semibold text-ink">{record.mapType}</div>
          <div className="flex flex-wrap gap-x-3 text-sm text-muted">
            <span>{record.played} played</span>
            <span>{record.won}-{record.lost}</span>
            <span>{formatPct(record.winRate)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Play a game mode at least {MIN_MAP_PLAYS} times to see this.</p>
      )}
    </Card>
  );
}

function MapCard({ title, record }: { title: string; record: MapRecord | null }) {
  return (
    <Card title={title}>
      {record ? (
        <div className="space-y-1">
          <div className="text-lg font-semibold text-ink">{record.mapName}</div>
          <div className="flex flex-wrap gap-x-3 text-sm text-muted">
            <span>{record.mapType}</span>
            <span>{record.played} played</span>
            <span>{record.won}-{record.lost}</span>
            <span>{formatPct(record.winRate)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Play a map at least {MIN_MAP_PLAYS} times to see this.</p>
      )}
    </Card>
  );
}
