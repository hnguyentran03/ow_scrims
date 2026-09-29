"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/card";
import { TEAM_COLORS } from "@/lib/colors";
import { formatDuration, formatInt, formatPct } from "@/lib/format";
import type { Cell, Heatmap, Marker, Route } from "@/lib/stats/heatmap";
import type { Replay } from "@/lib/stats/replay";
import type { SideKey, Sides } from "@/lib/stats/sides";
import { OBJECTIVE_RADIUS_METERS, TERRITORY_MAJORITY, type Territory } from "@/lib/stats/territory";
import { markerRadius, NO_POSITIONS, StageCanvas } from "../stage-canvas";

export type Layer = "kills" | "deaths" | "fights" | "damage" | "healing" | "presence" | "routes" | "territory";
const LAYERS: Array<{ key: Layer; label: string }> = [
  { key: "kills", label: "Kills" }, { key: "deaths", label: "Deaths" }, { key: "fights", label: "Fights" }, { key: "damage", label: "Damage" },
  { key: "healing", label: "Healing" }, { key: "presence", label: "Presence" }, { key: "routes", label: "Routes" }, { key: "territory", label: "Territory" },
];
const DENSITY: Layer[] = ["damage", "healing", "presence"];
const HUES = { healing: "#22c55e", presence: "#a1a1aa", both: "#f59e0b" };
const NEUTRAL = "#71717a";

const sideColor = (side: SideKey | null) => (side ? TEAM_COLORS[side] : NEUTRAL);

export function HeatmapPanel({ heatmap, stage, sides, fights, hasPositions, filterSide, territory = null, objectiveHref = null }: {
  heatmap: Heatmap;
  stage: Replay["stages"][number];
  sides: Sides;
  fights: Array<{ index: number; start: number }>;
  hasPositions: boolean;
  filterSide: SideKey | "both";
  territory?: Territory | null;
  objectiveHref?: string | null;
}) {
  const [layers, setLayers] = useState<Set<Layer>>(() => new Set<Layer>(["kills", "deaths"]));
  const [routeFight, setRouteFight] = useState<"all" | number>("all");
  const [approach, setApproach] = useState(false);
  const toggle = (l: Layer) => setLayers((prev) => {
    const next = new Set(prev);
    if (next.has(l)) next.delete(l);
    else next.add(l);
    return next;
  });
  const on = (l: Layer) => layers.has(l);
  const { grid } = heatmap;
  const r = markerRadius(stage);
  const densityOn = DENSITY.filter(on);
  const damageHue = filterSide === "both" ? HUES.both : TEAM_COLORS[filterSide];
  const hueOf = (l: Layer) => (l === "damage" ? damageHue : l === "healing" ? HUES.healing : HUES.presence);
  const max = (cells: Cell[]) => Math.max(1, ...cells.map((c) => c.v));
  const visibleLayers = LAYERS.filter((l) => l.key !== "territory" || territory !== null);

  if (!hasPositions) {
    return <p className="text-sm text-zinc-400">{NO_POSITIONS}</p>;
  }

  const empty = heatmap.points.deaths.length === 0 && heatmap.points.kills.length === 0 && heatmap.routes.length === 0;
  const routes = heatmap.routes.filter((rt) => routeFight === "all" || rt.fightIndex === routeFight);
  const cutAt = routeFight === "all" ? null : fights.find((f) => f.index === routeFight)?.start ?? null;
  const routePoints = (rt: Route) => (approach && cutAt !== null ? rt.points.filter((p) => p[2] <= cutAt) : rt.points);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        {visibleLayers.map((l) => (
          <button key={l.key} type="button" onClick={() => toggle(l.key)} aria-pressed={on(l.key)} className={`rounded px-2 py-0.5 ${on(l.key) ? "bg-zinc-100 text-black" : "bg-zinc-800 text-zinc-300"}`}>
            {l.label}
          </button>
        ))}
      </div>
      {on("routes") && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <label>
            Fight{" "}
            <select value={String(routeFight)} onChange={(e) => setRouteFight(e.target.value === "all" ? "all" : Number(e.target.value))} className="rounded bg-zinc-900 px-2 py-1 text-zinc-200">
              <option value="all">All fights</option>
              {fights.map((f) => (
                <option key={f.index} value={f.index}>Fight {f.index} · {formatDuration(f.start)}</option>
              ))}
            </select>
          </label>
          <label className={routeFight === "all" ? "opacity-50" : ""}>
            <input type="checkbox" checked={approach} disabled={routeFight === "all"} onChange={(e) => setApproach(e.target.checked)} className="mr-1" />
            Approach only (up to the first kill)
          </label>
        </div>
      )}

      <StageCanvas stage={stage}>
        {on("territory") && territory && (
          <>
            <defs>
              <pattern id="contested" width={grid.cellW / 2} height={grid.cellH / 2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={grid.cellH / 2} stroke="#e4e4e7" strokeWidth={grid.cellW / 12} />
              </pattern>
            </defs>
            <g opacity={0.35}>
              {territory.cells.map((c) => (
                <rect key={`t${c.c},${c.r}`} x={c.c * grid.cellW} y={c.r * grid.cellH} width={grid.cellW} height={grid.cellH} fill={c.owner === "contested" ? "url(#contested)" : TEAM_COLORS[c.owner]} />
              ))}
            </g>
          </>
        )}
        {densityOn.map((l, i) => {
          const cells = heatmap.density[l as "damage" | "healing" | "presence"];
          const m = max(cells);
          return (
            <g key={l} style={i > 0 ? { mixBlendMode: "multiply" } : undefined}>
              {cells.map((c) => (
                <rect key={`${c.c},${c.r}`} x={c.c * grid.cellW} y={c.r * grid.cellH} width={grid.cellW} height={grid.cellH} fill={hueOf(l)} opacity={0.15 + 0.75 * Math.sqrt(c.v / m)} />
              ))}
            </g>
          );
        })}
        {on("routes") && routes.map((rt, i) => {
          const pts = routePoints(rt);
          if (pts.length < 2) return null;
          const last = pts[pts.length - 1];
          return (
            <g key={i} stroke={sideColor(rt.side)} strokeOpacity={0.6} fill="none">
              <polyline points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} strokeWidth={r / 3} />
              <circle cx={last[0]} cy={last[1]} r={r / 2} fill={sideColor(rt.side)} fillOpacity={0.6} stroke="none" />
            </g>
          );
        })}
        {on("fights") && heatmap.points.fights.map((m, i) => (
          <g key={`f${i}`}>
            <circle cx={m.px} cy={m.py} r={r * 1.6} fill="#18181b" stroke={sideColor(m.side)} strokeWidth={r / 4} />
            <text x={m.px} y={m.py} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.4} fill="#e4e4e7">{m.label.replace("Fight ", "")}</text>
            <title>{`${m.label} · ${formatDuration(m.t)}`}</title>
          </g>
        ))}
        {on("kills") && heatmap.points.kills.map((m, i) => <Dot key={`k${i}`} m={m} r={r} />)}
        {on("deaths") && heatmap.points.deaths.map((m, i) => <Cross key={`d${i}`} m={m} r={r} />)}
      </StageCanvas>

      {empty && <p className="text-sm text-zinc-400">No positions in this stage.</p>}
      <p className="text-xs text-zinc-500">{legend(layers, heatmap, sides, filterSide)}</p>

      {on("territory") && (
        <ObjectiveCard territory={territory} objectiveHref={objectiveHref} sides={sides} />
      )}
    </div>
  );
}

function Dot({ m, r }: { m: Marker; r: number }) {
  return (
    <circle cx={m.px} cy={m.py} r={r} fill={sideColor(m.side)} fillOpacity={0.85} stroke="#09090b" strokeWidth={r / 5}>
      <title>{`${m.label} · ${m.hero} · ${formatDuration(m.t)}`}</title>
    </circle>
  );
}

function Cross({ m, r }: { m: Marker; r: number }) {
  return (
    <g stroke={sideColor(m.side)} strokeWidth={r / 3} strokeLinecap="round">
      <line x1={m.px - r} y1={m.py - r} x2={m.px + r} y2={m.py + r} />
      <line x1={m.px - r} y1={m.py + r} x2={m.px + r} y2={m.py - r} />
      <title>{`${m.label} · ${m.hero} · ${formatDuration(m.t)}`}</title>
    </g>
  );
}

function legend(layers: Set<Layer>, heatmap: Heatmap, sides: Sides, filterSide: SideKey | "both"): string {
  const parts: string[] = [];
  const side = filterSide === "both" ? `${sides.ours} blue, ${sides.theirs} red` : sides[filterSide];
  if (layers.has("kills")) parts.push(`dots are kills (${side})`);
  if (layers.has("deaths")) parts.push("crosses are deaths");
  if (layers.has("fights")) parts.push("numbered rings are fight centres");
  if (layers.has("damage")) parts.push(`damage up to ${formatInt(Math.max(0, ...heatmap.density.damage.map((c) => c.v)))} per cell`);
  if (layers.has("healing")) parts.push(`healing (green) up to ${formatInt(Math.max(0, ...heatmap.density.healing.map((c) => c.v)))} per cell`);
  if (layers.has("presence")) parts.push(`presence (grey) up to ${Math.max(0, ...heatmap.density.presence.map((c) => c.v)).toFixed(1)} s per cell`);
  if (layers.has("routes")) parts.push("lines are movement between position samples, dot at the end");
  if (layers.has("territory")) parts.push(`tint is the side with at least ${Math.round(TERRITORY_MAJORITY * 100)}% of presence in a cell, hatched is contested`);
  return parts.length ? `${parts.join(" · ")}. Presence is measured while players deal or receive damage or healing.` : "";
}

function ObjectiveCard({ territory, objectiveHref, sides }: { territory: Territory | null; objectiveHref: string | null; sides: Sides }) {
  if (!territory || !territory.objective) {
    return (
      <Card title="Objective control">
        <p className="text-sm text-zinc-400">
          {objectiveHref ? <>Mark the objective centre under <Link href={objectiveHref} className="underline">Maps</Link> to see objective control.</> : "Objective control needs a calibrated map image with a marked objective centre; map images are not available yet."}
        </p>
      </Card>
    );
  }
  const o = territory.objective;
  const bar = (share: { ours: number; theirs: number; contested: number }) => (
    <div className="flex h-3 overflow-hidden rounded bg-zinc-800">
      <span style={{ width: `${share.ours * 100}%`, background: TEAM_COLORS.ours }} />
      <span style={{ width: `${share.contested * 100}%`, background: "#52525b" }} />
      <span style={{ width: `${share.theirs * 100}%`, background: TEAM_COLORS.theirs }} />
    </div>
  );
  return (
    <Card title="Objective control" note={`Observed ${formatDuration(o.observedSeconds)} · within ${OBJECTIVE_RADIUS_METERS} m of the marked centre`}>
      <div className="space-y-3 text-sm">
        {bar(o.stage)}
        <p className="text-xs text-zinc-400">{sides.ours} {formatPct(o.stage.ours)} · contested {formatPct(o.stage.contested)} · {sides.theirs} {formatPct(o.stage.theirs)}</p>
        {o.byFight.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="py-1">Fight</th><th>Winner</th><th>{sides.ours}</th><th>Contested</th><th>{sides.theirs}</th></tr>
            </thead>
            <tbody>
              {o.byFight.map((f) => (
                <tr key={f.index} className="border-t border-zinc-800 tabular-nums">
                  <td className="py-1">{f.index}</td>
                  <td style={{ color: f.winner ? TEAM_COLORS[f.winner] : undefined }}>{f.winner ? sides[f.winner] : "even"}</td>
                  <td>{f.share ? formatPct(f.share.ours) : "—"}</td><td>{f.share ? formatPct(f.share.contested) : "—"}</td><td>{f.share ? formatPct(f.share.theirs) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-zinc-500">Presence is measured while players deal or receive damage or healing.</p>
      </div>
    </Card>
  );
}
