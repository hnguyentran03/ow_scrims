import Link from "next/link";
import { notFound } from "next/navigation";
import { Stat } from "@/components/stat";
import { getDb } from "@/lib/db";
import { getTeamRows } from "@/lib/db/queries";
import { formatDuration, formatInt, formatPct, formatPer10, formatSeconds } from "@/lib/format";
import { parseHero, parseRange, type SearchParams } from "@/lib/range";
import { BEST_PERFORMANCE_MIN_SECONDS, buildPlayerPage, playerHeroes, resolvePlayerName, type BestPerformance, type HeroCount, type MethodCount, type PlayerCards } from "@/lib/stats/player";
import { MIN_PROFILE_MAPS, MIN_PROFILE_SECONDS, type PersonalRecord, type ProfileCards } from "@/lib/stats/player-cards";
import { Card } from "@/components/card";
import { Empty } from "../../empty";
import { EmptyRange } from "../../empty-range";
import { mapRecordRows, RecordTable, typeRecordRows } from "../../record-table";
import { HeroSelect } from "./hero-select";
import { StatChart } from "./stat-chart";

export const dynamic = "force-dynamic";

const two = (v: number | null) => (v === null ? "–" : v.toFixed(2));
const OUTCOME_LABEL = { won: "Won", lost: "Lost", undecided: "N/A" } as const;

export default async function PlayerDetailPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: SearchParams }) {
  const { name: raw } = await params;
  const query = await searchParams;
  const range = parseRange(query);
  const rows = await getTeamRows(await getDb(), range, { playerStats: true, kills: true, ults: true, charged: true, rounds: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const name = resolvePlayerName(rows.maps, rows.playerStats, raw);
  if (name === undefined) notFound();
  const heroes = playerHeroes(rows.maps, rows.playerStats, name);
  const p = buildPlayerPage(rows.maps, rows, name, parseHero(query, heroes));
  const hidden: Array<[string, string]> = [];
  if (range.from) hidden.push(["from", range.from]);
  if (range.to) hidden.push(["to", range.to]);
  const o = p.overview;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{p.name}</h2>
          {p.hero && <p className="text-xs text-zinc-500">Showing {p.hero} only</p>}
        </div>
        <HeroSelect action={`/team/players/${encodeURIComponent(name)}`} hidden={hidden} heroes={p.heroes} hero={p.hero} />
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Maps" value={String(o.maps)} />
        <Stat label="Time played" value={formatDuration(o.timePlayed)} />
        <Stat label="Record" value={`${o.record.won}-${o.record.lost}`} hint={`${o.record.undecided} undecided`} />
        <Stat label="Win rate" value={formatPct(o.winRate)} hint="decided maps" />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Elims / 10" value={formatPer10(o.per10.eliminations)} />
        <Stat label="Final blows / 10" value={formatPer10(o.per10.finalBlows)} />
        <Stat label="Deaths / 10" value={formatPer10(o.per10.deaths)} />
        <Stat label="Hero damage / 10" value={formatPer10(o.per10.heroDamage)} />
        <Stat label="Healing / 10" value={formatPer10(o.per10.healing)} />
        <Stat label="Damage taken / 10" value={formatPer10(o.per10.damageTaken)} />
        <Stat label="Damage blocked / 10" value={formatPer10(o.per10.damageBlocked)} />
      </div>

      <Cards c={p.cards} />

      <Profile profile={p.profile} hero={p.hero} />

      <Card title="Personal records" note="Best single map in range; longest life is the longest gap between deaths on a map, counted from the round start; a map with no deaths is skipped">
        <Records rows={p.profile.records} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Most played heroes">
          {p.mostPlayed.length === 0 ? <Empty /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="py-1">Hero</th><th>Role</th><th>Time</th><th>Share</th></tr>
              </thead>
              <tbody>
                {p.mostPlayed.map((h) => (
                  <tr key={h.hero} className="border-t border-zinc-800 tabular-nums">
                    <td className="py-1">{h.hero}</td><td>{h.role}</td><td>{formatDuration(h.playtime)}</td><td>{formatPct(h.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Time per role">
          {p.timeByRole.length === 0 ? <Empty /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="py-1">Role</th><th>Time</th><th>Share</th></tr>
              </thead>
              <tbody>
                {p.timeByRole.map((r) => (
                  <tr key={r.role} className="border-t border-zinc-800 tabular-nums">
                    <td className="py-1">{r.role}</td><td>{formatDuration(r.playtime)}</td><td>{formatPct(o.timePlayed > 0 ? r.playtime / o.timePlayed : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Best performance" note={`Highest final blows per 10 on a map-hero pair with at least ${BEST_PERFORMANCE_MIN_SECONDS / 60} minutes`}>
        <Best best={p.bestPerformance} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Win rate by map">
          <RecordTable head="Map" rows={mapRecordRows(p.winRateByMap)} />
        </Card>
        <Card title="Win rate by map type">
          <RecordTable head="Map type" rows={typeRecordRows(p.winRateByType)} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Final blows by method"><MethodList rows={p.finalBlowsByMethod} /></Card>
        <Card title="Died to most" note="any kill row"><HeroList rows={p.diedToMost} /></Card>
        <Card title="Final blows on most"><HeroList rows={p.finalBlowsOnMost} /></Card>
      </div>

      <Card title="Per 10 minutes by scrim" note="Over this player's maps in each scrim">
        <StatChart points={p.chart} />
      </Card>
    </div>
  );
}

function Cards({ c }: { c: PlayerCards }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="First pick %" value={formatPct(c.firstPick.rate)} hint={`${c.firstPick.count} of ${c.firstPick.fights} fights on maps played; won ${c.firstPick.won}`} />
      <Stat label="First death %" value={formatPct(c.firstDeath.rate)} hint={`${c.firstDeath.count} of ${c.firstDeath.fights} fights on maps played`} />
      <Stat label="Reversal %" value={formatPct(c.reversal.rate)} hint={`${c.reversal.won} won of ${c.reversal.count} first deaths`} />
      <Stat label="Kills per ult" value={two(c.killsPerUlt.perUlt)} hint={`${c.killsPerUlt.kills} kills over ${c.killsPerUlt.ults} ults`} />
      <Stat label="Avg ult charge" value={formatSeconds(c.avgChargeSeconds)} hint="previous cast to charged" />
      <Stat label="Avg ult hold" value={formatSeconds(c.avgHoldSeconds)} hint="charged to cast" />
    </div>
  );
}

function Best({ best }: { best: BestPerformance | null }) {
  if (!best) return <p className="text-sm text-zinc-500">No map-hero pair with enough time yet.</p>;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      <Link href={`/scrims/${best.scrimId}/maps/${best.mapId}`} className="text-lg font-semibold hover:underline">{best.mapName}</Link>
      <span className="text-zinc-400">{best.scrimName} · {best.scrimDate}</span>
      <span>{best.hero}</span>
      <span className="tabular-nums">{formatDuration(best.timePlayed)}</span>
      <span className="tabular-nums">{formatPer10(best.fbPer10)} final blows / 10 ({best.finalBlows})</span>
      <span>{OUTCOME_LABEL[best.outcome]}</span>
    </div>
  );
}

function MethodList({ rows }: { rows: MethodCount[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="space-y-1 text-sm tabular-nums">
      {rows.map((r) => (
        <li key={r.method} className="flex justify-between gap-2"><span>{r.method}</span><span>{r.count} <span className="text-zinc-500">({formatPct(r.share)})</span></span></li>
      ))}
    </ul>
  );
}

function HeroList({ rows }: { rows: HeroCount[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="space-y-1 text-sm tabular-nums">
      {rows.map((r) => (
        <li key={r.hero} className="flex justify-between gap-2"><span>{r.hero}</span><span>{r.count}</span></li>
      ))}
    </ul>
  );
}

const needMaps = `Needs ${MIN_PROFILE_MAPS} maps in range`;
const needRatedMaps = `Needs ${MIN_PROFILE_MAPS} maps with at least ${MIN_PROFILE_SECONDS / 60} minutes played`;
const one = (v: number) => v.toFixed(1);

function Profile({ profile: pr, hero }: { profile: ProfileCards; hero: string | null }) {
  const droughtScope = hero === null ? "" : `; gaps between ${hero} final blows only`;
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Stat label="MVP score" value={pr.mvp.score === null ? "–" : String(Math.round(pr.mvp.score))} hint={pr.mvp.score === null ? needRatedMaps : `MVP on ${pr.mvp.mvpCount} of ${pr.mvp.maps} maps; 100 is the role average`} />
      <Stat label="Deadlift share" value={formatPct(pr.deadlift?.meanShare ?? null)} hint={pr.deadlift ? `best ${formatPct(pr.deadlift.best.share)} of our hero damage on ${pr.deadlift.best.mapName}` : needMaps} />
      <Stat label="Final-blow drought" value={formatSeconds(pr.drought?.longestSeconds ?? null)} hint={pr.drought ? `longest on ${pr.drought.longestMap.mapName}; mean ${formatSeconds(pr.drought.meanSeconds)}${droughtScope}` : "No final blows in range"} />
      <Stat label="Play style" value={pr.playStyle?.sentence ?? "–"} hint={pr.playStyle ? `aggression ${one(pr.playStyle.aggression)}, survival ${one(pr.playStyle.survival)}, output ${one(pr.playStyle.output)} vs role` : needRatedMaps} />
    </div>
  );
}

const RECORD_VALUE: Record<PersonalRecord["key"], (v: number) => string> = {
  finalBlows: String, eliminations: String, heroDamage: formatInt, healing: formatInt, damageBlocked: formatInt,
  multikillBest: String, soloKills: String, objectiveKills: String, longestLife: (v) => formatDuration(v),
};

function Records({ rows }: { rows: PersonalRecord[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr><th className="py-1">Record</th><th>Value</th><th>Map</th><th>Date</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-zinc-800 tabular-nums">
            <td className="py-1">{r.label}</td>
            <td>{RECORD_VALUE[r.key](r.value)}</td>
            <td><Link href={`/scrims/${r.scrimId}/maps/${r.mapId}`} className="hover:underline">{r.mapName}</Link></td>
            <td className="text-zinc-400">{r.scrimDate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
