import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Stat } from "@/components/stat";
import { formatPct, formatPer10, formatRatio } from "@/lib/format";
import type { RoleCard } from "@/lib/stats/performance";

export function RoleCards({ roles }: { roles: RoleCard[] }) {
  return (
    <Card title="Performance by role" note="Our side's final rows; a flexed player counts for the role they played most on each map.">
      {roles.length === 0 ? (
        <EmptyState>No hero time on our side in this range.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {roles.map((r) => (
            <section key={r.role} className="space-y-3">
              <h3 className="font-display text-base tracking-[0.03em] text-ink">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-ours" aria-hidden />
                {r.role}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="K/D" value={formatRatio(r.kd)} hint="final blows per death" />
                <Stat label="Damage / 10" value={formatPer10(r.damagePer10)} />
                <Stat label="Healing / 10" value={formatPer10(r.healingPer10)} />
                <Stat label="Deaths / 10" value={formatPer10(r.deathsPer10)} />
                <Stat label="Ult efficiency" value={formatPct(r.ultEfficiency)} hint={`${r.casts} ults, share cast in fights we won`} />
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
