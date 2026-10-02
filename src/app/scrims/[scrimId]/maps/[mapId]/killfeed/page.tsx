import { getInitiationDamage, getKillfeedRows } from "@/lib/db/queries";
import { formatDuration } from "@/lib/format";
import { TEAM_COLORS } from "@/lib/colors";
import { buildKillfeed, type KillfeedBlock, type KillfeedEntry } from "@/lib/stats/killfeed";
import { groupFights } from "@/lib/stats/fights";
import { buildInitiation, type FightInitiation } from "@/lib/stats/initiation";
import { sideOf, type Sides } from "@/lib/stats/sides";
import { loadMap, type MapParams } from "../load-map";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/badge";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Table, Th, Td } from "@/components/table";

export const dynamic = "force-dynamic";

export default async function KillfeedPage({ params }: { params: MapParams }) {
  const { db, map, scrim, sides } = await loadMap(params);
  const rows = await getKillfeedRows(db, map.id);
  const initDamage = await getInitiationDamage(db, map.id);
  const initiation = buildInitiation(groupFights(rows.kills), initDamage, sides);
  const byFight = new Map(initiation.fights.map((f) => [f.index, f]));
  const kf = buildKillfeed({ map, kills: rows.kills, rezzes: rows.rezzes, roundEnds: rows.roundEnds, durationSeconds: map.durationSeconds });
  const pair = (p: { ours: number; theirs: number }) => `${p.ours} / ${p.theirs}`;
  const hint = `${sides.ours} / ${sides.theirs}`;
  const hasFights = kf.blocks.some((b) => b.kind === "fight");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <a href={`/api/scrims/${scrim.id}/maps/${map.id}/killfeed.csv`} download className="text-sm text-muted hover:text-ink">
          Download CSV
        </a>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Match time" value={formatDuration(kf.header.matchTime)} />
        <Stat label="Kills" value={pair(kf.header.kills)} hint={hint} />
        <Stat label="Deaths" value={pair(kf.header.deaths)} hint={hint} />
        <Stat label="Fight wins" value={pair(kf.header.fightWins)} hint={hint} />
      </section>

      {!hasFights ? (
        <EmptyState>No fights recorded on this map.</EmptyState>
      ) : (
        <div className="space-y-4">
          {kf.blocks.map((block, i) => (
            <Block key={i} block={block} sides={sides} initiation={byFight.get(block.kind === "fight" ? block.fight.index : -1) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function Block({ block, sides, initiation }: { block: KillfeedBlock; sides: Sides; initiation: FightInitiation | null }) {
  if (block.kind === "round") {
    const side = block.capturingTeam ? sideOf(block.capturingTeam, sides) : null;
    const color = side ? TEAM_COLORS[side] : "var(--color-muted)";
    return (
      <div className="rounded-control py-2 text-center text-sm font-medium" style={{ backgroundImage: `repeating-linear-gradient(135deg, color-mix(in srgb, ${color} 20%, transparent) 0 8px, transparent 8px 16px)`, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` }}>
        Round {block.roundNumber}{block.capturingTeam ? `, captured by ${block.capturingTeam}` : " ended"}
      </div>
    );
  }
  const { fight, entries } = block;
  const seconds = initiation?.secondsToFirstKill ?? null;
  const secondsLabel = seconds === null ? null : seconds < 0 ? `${Math.abs(seconds).toFixed(1)} s after the first kill` : `${seconds.toFixed(1)} s before the first kill`;
  return (
    <Card
      title={`Fight ${fight.index}`}
      note={`${formatDuration(fight.start)} – ${formatDuration(fight.end)}, ${fight.winner ? `won by ${fight.winner}` : "even"}`}
      actions={
        initiation?.initiator ? (
          <span className="text-xs" style={{ color: initiation.initiator.side ? TEAM_COLORS[initiation.initiator.side] : "var(--color-muted)" }}>
            Engaged by {initiation.initiator.name} ({initiation.initiator.hero}), {secondsLabel}
          </span>
        ) : undefined
      }
    >
      <Table>
        <thead>
          <tr>
            <Th>Time</Th>
            <Th>Attacker</Th>
            <Th>Victim</Th>
            <Th>Method</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>{entries.map((e, i) => <Row key={i} entry={e} sides={sides} />)}</tbody>
      </Table>
    </Card>
  );
}

function Row({ entry, sides }: { entry: KillfeedEntry; sides: Sides }) {
  const tint = (team: string) => (team === sides.ours ? "bg-ours/8" : "");
  const actor = (a: { team: string; name: string; hero: string }) => (
    <span style={{ color: TEAM_COLORS[sideOf(a.team, sides) ?? "ours"] }}>
      {a.name}
      <span className="text-muted"> {a.hero}</span>
    </span>
  );
  if (entry.kind === "rez") {
    return (
      <tr className={tint(entry.resurrecter.team)}>
        <Td muted>{formatDuration(entry.time)}</Td>
        <Td>{actor(entry.resurrecter)}</Td>
        <Td>{actor(entry.resurrectee)}</Td>
        <Td muted>Resurrect</Td>
        <Td><Badge>Resurrection</Badge></Td>
      </tr>
    );
  }
  return (
    <tr className={tint(entry.attacker.team)}>
      <Td muted>{formatDuration(entry.time)}</Td>
      <Td>{entry.kind === "kill" ? actor(entry.attacker) : <span className="text-muted">—</span>}</Td>
      <Td>{actor(entry.victim)}</Td>
      <Td muted>{entry.method}</Td>
      <Td className="space-x-1">
        {entry.kind === "suicide" && <Badge>Suicide</Badge>}
        {entry.kind === "environmental" && <Badge>Environmental</Badge>}
        {entry.critical && <Badge>Critical</Badge>}
      </Td>
    </tr>
  );
}
