import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { TEAM_COLORS } from "@/lib/colors";
import { getChartRows, getInitiationDamage } from "@/lib/db/queries";
import { formatDuration } from "@/lib/format";
import { damageByRound, finalBlowsByRole, killsByFight } from "@/lib/stats/charts";
import { groupFights } from "@/lib/stats/fights";
import { buildInitiation, INITIATION_LOOKBACK_SECONDS } from "@/lib/stats/initiation";
import { sideOf, type Sides } from "@/lib/stats/sides";
import { buildTempo } from "@/lib/stats/tempo";
import {
  COMBO_WINDOW_SECONDS,
  COUNTER_WINDOW_SECONDS,
  counterUlts,
  keptCasts,
  ultAdvantageByFight,
  ultCombos,
  type CounterUlt,
  type UltCast,
  type UltCombo,
} from "@/lib/stats/ult-analysis";
import { loadMap, type MapParams } from "../load-map";
import { DamageByRoundChart } from "./damage-by-round-chart";
import { FinalBlowsByRoleChart } from "./final-blows-by-role-chart";
import { InitiationTable } from "./initiation-table";
import { KillsByFightChart } from "./kills-by-fight-chart";
import { TempoChart } from "./tempo-chart";
import { UltAdvantageTable } from "./ult-advantage-table";

export const dynamic = "force-dynamic";

export default async function ChartsPage({ params }: { params: MapParams }) {
  const { db, map, sides } = await loadMap(params);
  const rows = await getChartRows(db, map.id);
  const initDamage = await getInitiationDamage(db, map.id);
  const fights = groupFights(rows.kills);
  const initiation = buildInitiation(fights, initDamage, sides);
  const steps = killsByFight(fights, sides);
  const roles = finalBlowsByRole(rows.kills, sides);
  const rounds = damageByRound(rows.playerStats, sides);
  const tempo = buildTempo({ kills: rows.kills, starts: rows.ultStarts, ends: rows.ultEnds, fights, durationSeconds: map.durationSeconds, sides });
  const casts = keptCasts(rows.ultStarts, rows.ultEnds);
  const combos = ultCombos(rows.ultStarts, rows.ultEnds, fights);
  const counters = counterUlts(rows.ultStarts, rows.ultEnds);
  const advantage = ultAdvantageByFight(rows.ultCharged, rows.ultStarts, rows.ultEnds, fights, sides);
  const tempoNote = tempo.markers.length === 0 ? "No kills or ultimates recorded" : `${fights.length} fights, ${casts.length} ults`;

  return (
    <div className="space-y-6">
      <Card title="Tempo" note={tempoNote}>
        <TempoChart tempo={tempo} sides={sides} />
      </Card>
      <h2 className="font-display text-lg tracking-[0.03em] text-ink">Ultimates</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Ult advantage per fight" note="Held ults at each fight's first kill; a cast with no logged charge counts as not held">
          <UltAdvantageTable advantage={advantage} sides={sides} />
        </Card>
        <Card title="Ult combos" note={`Same-team casts within ${COMBO_WINDOW_SECONDS} s`}>
          <ComboList combos={combos} sides={sides} />
        </Card>
        <Card title="Counter-ult response" note={`Enemy cast within ${COUNTER_WINDOW_SECONDS} s of an ult`}>
          <CounterList counters={counters} casts={casts} sides={sides} />
        </Card>
        <Card title="Fight initiation" note={`First cross-team damage within ${INITIATION_LOOKBACK_SECONDS} s before the first kill`}>
          <InitiationTable initiation={initiation} sides={sides} />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
    </div>
  );
}

function teamColor(team: string, sides: Sides): string {
  const side = sideOf(team, sides);
  return side ? TEAM_COLORS[side] : "var(--color-muted)";
}

function ComboList({ combos, sides }: { combos: UltCombo[]; sides: Sides }) {
  if (combos.length === 0) return <EmptyState>None on this map.</EmptyState>;
  return (
    <ul className="space-y-1 text-sm">
      {combos.map((c, i) => (
        <li key={i} className="flex flex-wrap gap-x-3">
          <span className="tabular-nums text-muted">{formatDuration(c.casts[0].time)}</span>
          <span style={{ color: teamColor(c.team, sides) }}>{c.casts.map((x) => `${x.player} (${x.hero})`).join(" + ")}</span>
          {c.fightIndex ? <span className="text-muted">fight {c.fightIndex}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function CounterList({ counters, casts, sides }: { counters: CounterUlt[]; casts: UltCast[]; sides: Sides }) {
  const answeredBy = (side: "ours" | "theirs") => counters.filter((c) => sideOf(c.answer.team, sides) === side);
  const castsBy = (side: "ours" | "theirs") => casts.filter((c) => sideOf(c.team, sides) === side).length;
  const mean = (list: CounterUlt[]) => (list.length ? `${(list.reduce((n, c) => n + c.delaySeconds, 0) / list.length).toFixed(1)} s` : "–");
  return (
    <div className="space-y-2 text-sm">
      <p className="flex flex-wrap gap-x-3 text-xs text-muted">
        <span>{sides.ours} answered {answeredBy("ours").length} of {castsBy("theirs")} enemy ults, avg {mean(answeredBy("ours"))}</span>
        <span>{sides.theirs} answered {answeredBy("theirs").length} of {castsBy("ours")} enemy ults, avg {mean(answeredBy("theirs"))}</span>
        <span>{casts.length} ults total</span>
      </p>
      {counters.length === 0 ? (
        <EmptyState>None on this map.</EmptyState>
      ) : (
        <ul className="space-y-1">
          {counters.map((c, i) => (
            <li key={i}>
              <span className="tabular-nums text-muted">{formatDuration(c.ult.time)}</span>{" "}
              <span style={{ color: teamColor(c.answer.team, sides) }}>{c.answer.player} ({c.answer.hero})</span>
              <span className="text-muted"> answered </span>
              <span style={{ color: teamColor(c.ult.team, sides) }}>{c.ult.player} ({c.ult.hero})</span>
              <span className="text-muted"> in {c.delaySeconds.toFixed(1)} s</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
