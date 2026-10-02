import { Card } from "@/components/card";
import { Stat } from "@/components/stat";
import { Table, Td, Th } from "@/components/table";
import { TEAM_COLORS } from "@/lib/colors";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatPct, formatRatio } from "@/lib/format";
import { parseRange, type SearchParams } from "@/lib/range";
import { MIN_ABILITY_FIGHTS, buildAbilityImpact } from "@/lib/stats/ability-impact";
import { fightsByMap } from "@/lib/stats/fights";
import { buildTeamInitiation, type InitiationSummary, type TeamInitiation } from "@/lib/stats/initiation";
import { buildTeamfights, type TeamFightStats } from "@/lib/stats/teamfights";
import { MIN_IMPACT_FIGHTS, buildUltImpact } from "@/lib/stats/ult-impact";
import { EmptyRange } from "../empty-range";
import { AbilityImpactTable } from "./ability-impact-table";
import { UltImpactTable } from "./ult-impact-table";

export const dynamic = "force-dynamic";

export default async function TeamfightsPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await getTeamRows(await getDb(), parseRange(await searchParams), { kills: true, ults: true, playerStats: true, abilities: true, damage: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const fights = fightsByMap(rows.kills);
  const t = buildTeamfights(rows.maps, fights, rows.ultStarts, rows.ultEnds);
  const ultImpact = buildUltImpact(rows.maps, rows.kills, fights, rows.ultStarts, rows.ultEnds, rows.playerStats);
  const abilityImpact = buildAbilityImpact(rows.maps, fights, rows.abilities, rows.playerStats);
  const initiation = buildTeamInitiation(rows.maps, fights, rows.damage);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Column title="Ours" color={TEAM_COLORS.ours} stats={t.ours} init={initiation.summary.ours} coverage={initiation} />
        <Column title="Theirs" color={TEAM_COLORS.theirs} stats={t.theirs} init={initiation.summary.theirs} coverage={initiation} />
      </div>
      <Card title="By scrim">
        <Table>
          <thead>
            <tr><Th>Scrim</Th><Th>Date</Th><Th numeric>Fights</Th><Th numeric>W</Th><Th numeric>L</Th><Th numeric>Draw</Th><Th numeric>Win %</Th></tr>
          </thead>
          <tbody>
            {t.byScrim.map((s) => (
              <tr key={s.scrimId}>
                <Td>{s.name}</Td>
                <Td muted>{s.date}</Td>
                <Td numeric>{s.fights}</Td>
                <Td numeric>{s.won}</Td>
                <Td numeric>{s.lost}</Td>
                <Td numeric>{s.drawn}</Td>
                <Td numeric>{formatPct(s.winRate)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card title="Ultimate impact" note={`Fight win rate with and without each hero's ultimate; draws count as fights but not wins. Lift needs ${MIN_IMPACT_FIGHTS} decided fights in each column.`}>
        <UltImpactTable ours={ultImpact.ours} theirs={ultImpact.theirs} />
      </Card>
      <Card title="Ability impact" note={`Uses per decided fight won and lost. Means and lift need ${MIN_ABILITY_FIGHTS} fights in each column. A use can log more than one row. A use in the lull before a fight counts toward that fight.`}>
        <AbilityImpactTable ours={abilityImpact.ours} theirs={abilityImpact.theirs} hasAbilities={abilityImpact.hasAbilities} />
      </Card>
    </div>
  );
}

function Column({ title, color, stats: s, init, coverage }: { title: string; color: string; stats: TeamFightStats; init: InitiationSummary; coverage: TeamInitiation }) {
  return (
    <section className="space-y-3">
      <h2 className="text-md font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: color }} />{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <Stat label="Fight win rate" value={formatPct(s.winRate)} hint={`${s.won}-${s.lost}, ${s.drawn} even of ${s.fights}`} />
        <Stat label="First pick win rate" value={formatPct(s.firstPick.rate)} hint={`${s.firstPick.won} of ${s.firstPick.count} fights`} />
        <Stat label="First death win rate" value={formatPct(s.firstDeath.rate)} hint={`${s.reversals} reversals of ${s.firstDeath.count} fights`} />
        <Stat label="First ult win rate" value={formatPct(s.firstUlt.rate)} hint={`${s.firstUlt.won} of ${s.firstUlt.count} fights`} />
        <Stat label="Win rate engaging first" value={coverage.mapsWithDamage === 0 ? "–" : formatPct(init.initiationWinRate)} hint={engagedHint(init, coverage, true)} />
        <Stat label="Win rate when engaged" value={coverage.mapsWithDamage === 0 ? "–" : formatPct(init.nonInitiationWinRate)} hint={engagedHint(init, coverage, false)} />
        <Stat label="Dry fight rate" value={formatPct(s.dry.rate)} hint={`${s.dry.count} fights with no ult`} />
        <Stat label="Dry fight win rate" value={formatPct(s.dry.winRate)} hint={`${s.dry.won} of ${s.dry.count}`} />
        <Stat label="Ults per fight" value={formatRatio(s.ultsPerFight)} hint={`${s.ultsUsed} ults`} />
        <Stat label="Ult efficiency" value={formatRatio(s.ultEfficiency)} hint="fights won per ult" />
        <Stat label="Wasted ults" value={String(s.wastedUlts)} hint="in lost or even fights, or no fight" />
      </div>
    </section>
  );
}

function engagedHint(s: InitiationSummary, c: TeamInitiation, first: boolean): string {
  if (c.mapsWithDamage === 0) return "damage logging was off on every map in range";
  const base = first
    ? `won ${s.wonWhenInitiated} of ${s.decidedInitiated} decided fights, engaged first in ${s.initiated}`
    : `won ${s.wonWhenNotInitiated} of ${s.decidedNotInitiated} decided fights`;
  return c.mapsWithDamage < c.maps ? `${base}, ${c.mapsWithDamage} of ${c.maps} maps logged damage` : base;
}
