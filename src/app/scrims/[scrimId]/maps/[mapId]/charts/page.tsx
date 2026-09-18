import { getChartRows } from "@/lib/db/queries";
import { damageByRound, finalBlowsByRole, killsByFight } from "@/lib/stats/charts";
import { groupFights } from "@/lib/stats/fights";
import { loadMap, type MapParams } from "../load-map";
import { DamageByRoundChart } from "./damage-by-round-chart";
import { FinalBlowsByRoleChart } from "./final-blows-by-role-chart";
import { KillsByFightChart } from "./kills-by-fight-chart";

export const dynamic = "force-dynamic";

export default async function ChartsPage({ params }: { params: MapParams }) {
  const { db, map, sides } = await loadMap(params);
  const rows = await getChartRows(db, map.id);
  const fights = groupFights(rows.kills);
  const steps = killsByFight(fights, sides);
  const roles = finalBlowsByRole(rows.kills, sides);
  const rounds = damageByRound(rows.playerStats, sides);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Kills by fight" note={`${fights.length} fights`}>
        <KillsByFightChart points={steps} sides={sides} />
      </Card>
      <Card title="Final blows by role" note={roles.dropped ? `${roles.dropped} kills by unknown heroes not shown` : undefined}>
        <FinalBlowsByRoleChart bars={roles.bars} sides={sides} />
      </Card>
      <Card title="Cumulative hero damage by round" note={rounds.length === 0 ? "No player stats recorded" : undefined}>
        <DamageByRoundChart points={rounds} sides={sides} />
      </Card>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded border border-zinc-800 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">{title}</h2>
        {note && <span className="text-xs text-zinc-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}
