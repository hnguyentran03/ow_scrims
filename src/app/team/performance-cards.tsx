import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Stat } from "@/components/stat";
import { Table, Td, Th } from "@/components/table";
import { formatDuration, formatInt, formatPct } from "@/lib/format";
import { MIN_TRIO_PLAYS, type RoleCard, type TrioRow } from "@/lib/stats/performance";

const two = (v: number | null) => (v === null ? "–" : v.toFixed(2));
const one = (v: number) => v.toFixed(1);

export function RoleCards({ roles }: { roles: RoleCard[] }) {
  return (
    <Card title="Performance by role" note="Our side's final rows; a flexed player counts for the role they played most on each map.">
      {roles.length === 0 ? (
        <EmptyState>No hero time on our side in this range.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {roles.map((r) => (
            <section key={r.role} className="space-y-3">
              <h3 className="font-display text-lg tracking-[0.03em] text-ink">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-ours" aria-hidden />
                {r.role}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Playtime" value={formatDuration(r.playtime)} />
                <Stat label="Maps" value={String(r.maps)} />
                <Stat label="K/D" value={two(r.kd)} hint="final blows per death" />
                <Stat label="Damage / 10" value={formatInt(r.damagePer10)} />
                <Stat label="Healing / 10" value={formatInt(r.healingPer10)} />
                <Stat label="Deaths / 10" value={one(r.deathsPer10)} />
                <Stat label="Ult efficiency" value={formatPct(r.ultEfficiency)} hint={`${r.casts} ults, fights won per ult`} />
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TriosTable({ trios }: { trios: TrioRow[] }) {
  return (
    <Card title="Best trios" note={`Tank, damage, and support players who shared a map; needs ${MIN_TRIO_PLAYS} decided plays.`}>
      {trios.length === 0 ? (
        <EmptyState>No trio has {MIN_TRIO_PLAYS} decided maps together yet.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr><Th>Tank</Th><Th>Damage</Th><Th>Support</Th><Th numeric>Played</Th><Th numeric>Record</Th><Th numeric>Win %</Th></tr>
          </thead>
          <tbody>
            {trios.map((t) => (
              <tr key={`${t.tank}|${t.damage}|${t.support}`}>
                <Td>{t.tank}</Td>
                <Td>{t.damage}</Td>
                <Td>{t.support}</Td>
                <Td numeric>{t.played}</Td>
                <Td numeric>{t.won}-{t.lost}</Td>
                <Td numeric>{formatPct(t.winRate)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
