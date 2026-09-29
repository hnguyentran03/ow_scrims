import { Card } from "@/components/card";
import { Stat } from "@/components/stat";
import { TEAM_COLORS } from "@/lib/colors";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatPct } from "@/lib/format";
import { parseRange, type SearchParams } from "@/lib/range";
import { MIN_ABILITY_FIGHTS, buildAbilityImpact } from "@/lib/stats/ability-impact";
import { buildTeamfights, type TeamFightStats } from "@/lib/stats/teamfights";
import { MIN_IMPACT_FIGHTS, buildUltImpact } from "@/lib/stats/ult-impact";
import { EmptyRange } from "../empty-range";
import { AbilityImpactTable } from "./ability-impact-table";
import { UltImpactTable } from "./ult-impact-table";

export const dynamic = "force-dynamic";

export default async function TeamfightsPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await getTeamRows(await getDb(), parseRange(await searchParams), { kills: true, ults: true, playerStats: true, abilities: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const t = buildTeamfights(rows.maps, rows.kills, rows.ultStarts, rows.ultEnds);
  const ultImpact = buildUltImpact(rows.maps, rows.kills, rows.ultStarts, rows.ultEnds, rows.playerStats);
  const abilityImpact = buildAbilityImpact(rows.maps, rows.kills, rows.abilities, rows.playerStats);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Column title="Ours" color={TEAM_COLORS.ours} stats={t.ours} />
        <Column title="Theirs" color={TEAM_COLORS.theirs} stats={t.theirs} />
      </div>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">By scrim</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="py-1">Scrim</th><th>Date</th><th>Fights</th><th>W</th><th>L</th><th>Draw</th><th>Win %</th></tr>
          </thead>
          <tbody>
            {t.byScrim.map((s) => (
              <tr key={s.scrimId} className="border-t border-zinc-800 tabular-nums">
                <td className="py-1">{s.name}</td><td className="text-zinc-400">{s.date}</td><td>{s.fights}</td><td>{s.won}</td><td>{s.lost}</td><td>{s.drawn}</td><td>{formatPct(s.winRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Card title="Ultimate impact" note={`Fight win rate with and without each hero's ultimate; draws count as fights but not wins. Lift needs ${MIN_IMPACT_FIGHTS} decided fights in each column.`}>
        <UltImpactTable ours={ultImpact.ours} theirs={ultImpact.theirs} />
      </Card>
      <Card title="Ability impact" note={`Uses per decided fight won and lost. Means and lift need ${MIN_ABILITY_FIGHTS} fights in each column. A use can log more than one row. A use in the lull before a fight counts toward that fight.`}>
        <AbilityImpactTable ours={abilityImpact.ours} theirs={abilityImpact.theirs} hasAbilities={abilityImpact.hasAbilities} />
      </Card>
    </div>
  );
}

const two = (v: number | null) => (v === null ? "–" : v.toFixed(2));

function Column({ title, color, stats: s }: { title: string; color: string; stats: TeamFightStats }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: color }} />{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Fight win rate" value={formatPct(s.winRate)} hint={`${s.won}-${s.lost}, ${s.drawn} even of ${s.fights}`} />
        <Stat label="First pick win rate" value={formatPct(s.firstPick.rate)} hint={`${s.firstPick.won} of ${s.firstPick.count} fights`} />
        <Stat label="First death win rate" value={formatPct(s.firstDeath.rate)} hint={`${s.reversals} reversals of ${s.firstDeath.count} fights`} />
        <Stat label="First ult win rate" value={formatPct(s.firstUlt.rate)} hint={`${s.firstUlt.won} of ${s.firstUlt.count} fights`} />
        <Stat label="Dry fight rate" value={formatPct(s.dry.rate)} hint={`${s.dry.count} fights with no ult`} />
        <Stat label="Dry fight win rate" value={formatPct(s.dry.winRate)} hint={`${s.dry.won} of ${s.dry.count}`} />
        <Stat label="Ults per fight" value={two(s.ultsPerFight)} hint={`${s.ultsUsed} ults`} />
        <Stat label="Ult efficiency" value={two(s.ultEfficiency)} hint="fights won per ult" />
        <Stat label="Wasted ults" value={String(s.wastedUlts)} hint="in lost or even fights, or no fight" />
      </div>
    </section>
  );
}
