import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Stat } from "@/components/stat";
import { Table, Td, Th } from "@/components/table";
import { getDb } from "@/lib/db";
import { getTeamRows, ourRoster } from "@/lib/db/queries";
import { formatDuration, formatInt, formatPct, formatPer10, formatRatio, formatSeconds } from "@/lib/format";
import { nameCandidates } from "@/lib/player-name";
import { parseHero, parseRange, rangeQuery, type SearchParams } from "@/lib/range";
import { BEST_PERFORMANCE_MIN_SECONDS, buildPlayerPage, playerHeroes, resolvePlayerName, type BestPerformance, type HeroCount, type MethodCount, type PlayerCards } from "@/lib/stats/player";
import { MIN_PROFILE_MAPS, MIN_PROFILE_SECONDS, type PersonalRecord, type ProfileCards } from "@/lib/stats/player-cards";
import { Card } from "@/components/card";
import { Empty } from "../../empty";
import { EmptyRange } from "../../empty-range";
import { mapRecordRows, RecordTable, typeRecordRows } from "../../record-table";
import { HeroSelect } from "./hero-select";
import { StatChart } from "./stat-chart";

export const dynamic = "force-dynamic";

const OUTCOME_LABEL = { won: "Won", lost: "Lost", undecided: "N/A" } as const;

export default async function PlayerDetailPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: SearchParams }) {
  const { name: raw } = await params;
  const query = await searchParams;
  const range = parseRange(query);
  const db = await getDb();
  const rows = await getTeamRows(db, range, { playerStats: true, kills: true, ults: true, charged: true, rounds: true });
  if (rows.maps.length === 0) return <EmptyRange />;
  const name = resolvePlayerName(rows.maps, rows.playerStats, raw);
  if (name === undefined) {
    const known = await ourRoster(db);
    const candidate = nameCandidates(raw).find((n) => known.has(n));
    if (candidate === undefined) notFound();
    return (
      <div className="space-y-8">
        <PageHeader title={candidate} level={2} />
        <EmptyState>No maps for {candidate} in this range. Widen the dates.</EmptyState>
      </div>
    );
  }
  const heroes = playerHeroes(rows.maps, rows.playerStats, name);
  const hero = parseHero(query, heroes);
  // A ?hero= the new range cannot satisfy would otherwise be silently ignored and kept in the URL.
  // An empty value is the hero select's own "all heroes" choice, not a stale filter, so it stays.
  if (typeof query.hero === "string" && query.hero !== "" && hero === undefined) redirect(`/team/players/${encodeURIComponent(name)}${rangeQuery(range)}`);
  const p = buildPlayerPage(rows.maps, rows, name, hero);
  const hidden: Array<[string, string]> = [];
  if (range.from) hidden.push(["from", range.from]);
  if (range.to) hidden.push(["to", range.to]);
  const o = p.overview;

  return (
    <div className="space-y-8">
      <PageHeader
        title={p.name}
        level={2}
        meta={p.hero ? [`Showing ${p.hero} only`] : undefined}
        actions={<HeroSelect action={`/team/players/${encodeURIComponent(name)}`} hidden={hidden} heroes={p.heroes} hero={p.hero} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Maps" value={String(o.maps)} />
        <Stat label="Time played" value={formatDuration(o.timePlayed)} />
        <Stat label="Record" value={`${o.record.won}-${o.record.lost}`} hint={`${o.record.undecided} undecided`} />
        <Stat label="Win rate" value={formatPct(o.winRate)} hint="decided maps" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Most played heroes">
          {p.mostPlayed.length === 0 ? <Empty /> : (
            <Table>
              <thead>
                <tr><Th>Hero</Th><Th>Role</Th><Th numeric>Time</Th><Th numeric>Share</Th></tr>
              </thead>
              <tbody>
                {p.mostPlayed.map((h) => (
                  <tr key={h.hero} className="tabular-nums">
                    <Td>{h.hero}</Td><Td>{h.role}</Td><Td numeric>{formatDuration(h.playtime)}</Td><Td numeric>{formatPct(h.share)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card title="Time per role">
          {p.timeByRole.length === 0 ? <Empty /> : (
            <Table>
              <thead>
                <tr><Th>Role</Th><Th numeric>Time</Th><Th numeric>Share</Th></tr>
              </thead>
              <tbody>
                {p.timeByRole.map((r) => (
                  <tr key={r.role} className="tabular-nums">
                    <Td>{r.role}</Td><Td numeric>{formatDuration(r.playtime)}</Td><Td numeric>{formatPct(o.timePlayed > 0 ? r.playtime / o.timePlayed : null)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card title="Best performance" note={`Highest final blows per 10 on a map-hero pair with at least ${BEST_PERFORMANCE_MIN_SECONDS / 60} minutes`}>
        <Best best={p.bestPerformance} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Win rate by map">
          <RecordTable head="Map" rows={mapRecordRows(p.winRateByMap)} />
        </Card>
        <Card title="Win rate by map type">
          <RecordTable head="Map type" rows={typeRecordRows(p.winRateByType)} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

const samples = (n: number) => `${n} sample${n === 1 ? "" : "s"}`;

function Cards({ c }: { c: PlayerCards }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat label="First pick %" value={formatPct(c.firstPick.rate)} hint={`${c.firstPick.count} of ${c.firstPick.fights} fights on maps played; won ${c.firstPick.won}`} />
      <Stat label="First death %" value={formatPct(c.firstDeath.rate)} hint={`${c.firstDeath.count} of ${c.firstDeath.fights} fights on maps played`} />
      <Stat label="Reversal %" value={formatPct(c.reversal.rate)} hint={`${c.reversal.won} won of ${c.reversal.count} first deaths`} />
      <Stat label="Kills per ult" value={formatRatio(c.killsPerUlt.perUlt)} hint={`${c.killsPerUlt.kills} kills over ${c.killsPerUlt.ults} ults`} />
      <Stat label="Avg ult charge" value={formatSeconds(c.avgChargeSeconds)} hint={`previous cast to charged, ${samples(c.chargeSamples)}`} />
      <Stat label="Avg ult hold" value={formatSeconds(c.avgHoldSeconds)} hint={`charged to cast, ${samples(c.holdSamples)}`} />
    </div>
  );
}

function Best({ best }: { best: BestPerformance | null }) {
  if (!best) return <p className="text-sm text-muted">No map-hero pair with enough time yet.</p>;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      <Link href={`/scrims/${best.scrimId}/maps/${best.mapId}`} className="text-lg font-semibold hover:underline">{best.mapName}</Link>
      <span className="flex flex-wrap gap-x-3 text-muted">
        <span>{best.scrimName}</span>
        <span>{best.scrimDate}</span>
      </span>
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
    <Table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.method} className="tabular-nums">
            <Td>{r.method}</Td>
            <Td numeric>{r.count} <span className="text-muted">({formatPct(r.share)})</span></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function HeroList({ rows }: { rows: HeroCount[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <Table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.hero} className="tabular-nums">
            <Td>{r.hero}</Td>
            <Td numeric>{r.count}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

const needMaps = `Needs ${MIN_PROFILE_MAPS} maps in range`;
const needRatedMaps = `Needs ${MIN_PROFILE_MAPS} maps with at least ${MIN_PROFILE_SECONDS / 60} minutes played`;
const one = (v: number) => v.toFixed(1);

function Profile({ profile: pr, hero }: { profile: ProfileCards; hero: string | null }) {
  const droughtScope = hero === null ? "" : `; gaps between ${hero} final blows only`;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
    <Table>
      <thead>
        <tr><Th>Record</Th><Th numeric>Value</Th><Th>Map</Th><Th>Date</Th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="tabular-nums">
            <Td>{r.label}</Td>
            <Td numeric>{RECORD_VALUE[r.key](r.value)}</Td>
            <Td><Link href={`/scrims/${r.scrimId}/maps/${r.mapId}`} className="hover:underline">{r.mapName}</Link></Td>
            <Td muted>{r.scrimDate}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
