import { getKillfeedRows } from "@/lib/db/queries";
import { formatDuration } from "@/lib/format";
import { TEAM_COLORS } from "@/lib/colors";
import { buildKillfeed, type KillfeedBlock, type KillfeedEntry } from "@/lib/stats/killfeed";
import { sideOf, type Sides } from "@/lib/stats/sides";
import { loadMap, type MapParams } from "../load-map";
import { Stat } from "../stat";

export const dynamic = "force-dynamic";

export default async function KillfeedPage({ params }: { params: MapParams }) {
  const { db, map, sides } = await loadMap(params);
  const rows = await getKillfeedRows(db, map.id);
  const kf = buildKillfeed({ map, kills: rows.kills, rezzes: rows.rezzes, roundEnds: rows.roundEnds, durationSeconds: map.durationSeconds });
  const pair = (p: { ours: number; theirs: number }) => `${p.ours} / ${p.theirs}`;
  const hint = `${sides.ours} / ${sides.theirs}`;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Match time" value={formatDuration(kf.header.matchTime)} />
        <Stat label="Kills" value={pair(kf.header.kills)} hint={hint} />
        <Stat label="Deaths" value={pair(kf.header.deaths)} hint={hint} />
        <Stat label="Fight wins" value={pair(kf.header.fightWins)} hint={hint} />
      </section>

      {kf.blocks.length === 0 ? (
        <p className="text-sm text-zinc-400">No fights recorded.</p>
      ) : (
        <div className="space-y-4">{kf.blocks.map((block, i) => <Block key={i} block={block} sides={sides} />)}</div>
      )}
    </div>
  );
}

function Block({ block, sides }: { block: KillfeedBlock; sides: Sides }) {
  if (block.kind === "round") {
    const side = block.capturingTeam ? sideOf(block.capturingTeam, sides) : null;
    const color = side ? TEAM_COLORS[side] : "#52525b";
    return (
      <div
        className="rounded py-2 text-center text-xs font-medium uppercase tracking-wide"
        style={{ backgroundImage: `repeating-linear-gradient(135deg, ${color}33 0 8px, transparent 8px 16px)`, border: `1px solid ${color}66` }}
      >
        Round {block.roundNumber}{block.capturingTeam ? `, captured by ${block.capturingTeam}` : " ended"}
      </div>
    );
  }
  const { fight, entries } = block;
  return (
    <section className="rounded border border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-sm">
        <span className="font-medium">Fight {fight.index}</span>
        <span className="text-zinc-400">
          {formatDuration(fight.start)} – {formatDuration(fight.end)} · {fight.winner ? `won by ${fight.winner}` : "even"}
        </span>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="px-3 py-1 w-16">Time</th>
            <th className="px-3 py-1">Attacker</th>
            <th className="px-3 py-1">Victim</th>
            <th className="px-3 py-1">Method</th>
            <th className="px-3 py-1 w-40"></th>
          </tr>
        </thead>
        <tbody>{entries.map((e, i) => <Row key={i} entry={e} sides={sides} />)}</tbody>
      </table>
    </section>
  );
}

function Row({ entry, sides }: { entry: KillfeedEntry; sides: Sides }) {
  const tint = (team: string) => (team === sides.ours ? "bg-zinc-900/60" : "");
  const actor = (a: { team: string; name: string; hero: string }) => (
    <span style={{ color: TEAM_COLORS[sideOf(a.team, sides) ?? "ours"] }}>
      {a.name}
      <span className="text-zinc-500"> {a.hero}</span>
    </span>
  );
  if (entry.kind === "rez") {
    return (
      <tr className={tint(entry.resurrecter.team)}>
        <td className="px-3 py-1 tabular-nums text-zinc-400">{formatDuration(entry.time)}</td>
        <td className="px-3 py-1">{actor(entry.resurrecter)}</td>
        <td className="px-3 py-1">{actor(entry.resurrectee)}</td>
        <td className="px-3 py-1 text-zinc-400">Resurrect</td>
        <td className="px-3 py-1"><Badge>Resurrection</Badge></td>
      </tr>
    );
  }
  return (
    <tr className={tint(entry.attacker.team)}>
      <td className="px-3 py-1 tabular-nums text-zinc-400">{formatDuration(entry.time)}</td>
      <td className="px-3 py-1">{entry.kind === "kill" ? actor(entry.attacker) : <span className="text-zinc-500">—</span>}</td>
      <td className="px-3 py-1">{actor(entry.victim)}</td>
      <td className="px-3 py-1 text-zinc-400">{entry.method}</td>
      <td className="px-3 py-1 space-x-1">
        {entry.kind === "suicide" && <Badge>Suicide</Badge>}
        {entry.kind === "environmental" && <Badge>Environmental</Badge>}
        {entry.critical && <Badge>Critical</Badge>}
      </td>
    </tr>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">{children}</span>;
}
