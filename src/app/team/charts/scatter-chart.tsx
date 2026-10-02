"use client";

import { useId, useState } from "react";
import { Axes, H, linear, M, svgPoint, ticks, Tooltip, W } from "@/components/chart-utils";
import { EmptyState } from "@/components/empty-state";
import { Field, Select } from "@/components/field";
import { ROLE_COLORS } from "@/lib/colors";
import { formatPer10 } from "@/lib/format";
import { ROLE_ORDER } from "@/lib/stats/heroes";
import { linearFit } from "@/lib/stats/regression";
import { heroesOf, PRESETS, type ScatterPoint } from "@/lib/stats/scatter";
import { STAT_KEYS, STAT_LABELS, type StatKey } from "@/lib/stats/stat-keys";

const CUSTOM = "custom";
const HOVER_RADIUS = 12;

/** Ticks for [0, maxRaw] plus one more step above the data, so the top tick is drawn and the outermost point never sits on the plot edge. */
function domain(maxRaw: number): { max: number; ticks: number[] } {
  const base = ticks(0, maxRaw, 5);
  const step = base.length > 1 ? base[1] - base[0] : maxRaw;
  const max = Number(((Math.floor(maxRaw / step + 1e-9) + 1) * step).toFixed(6));
  return { max, ticks: [...base.filter((t) => t < max), max] };
}

export function ScatterChart({ points }: { points: ScatterPoint[] }) {
  const [preset, setPreset] = useState<string>(PRESETS[0].key);
  const [x, setX] = useState<StatKey>(PRESETS[0].x);
  const [y, setY] = useState<StatKey>(PRESETS[0].y);
  const [hero, setHero] = useState<string>("");
  const [trend, setTrend] = useState(true);
  const [hover, setHover] = useState<ScatterPoint | null>(null);
  const trendId = useId();
  const clipId = useId();

  if (points.length === 0) return <EmptyState>No player had three minutes on a hero in this range.</EmptyState>;

  const heroes = heroesOf(points);
  const activeHero = heroes.includes(hero) ? hero : "";
  const shown = activeHero ? points.filter((p) => p.hero === activeHero) : points;
  const xLabel = STAT_LABELS[x];
  const yLabel = STAT_LABELS[y];
  const xMaxRaw = Math.max(1, ...shown.map((p) => p.per10[x]));
  const yMaxRaw = Math.max(1, ...shown.map((p) => p.per10[y]));
  const xDomain = domain(xMaxRaw);
  const yDomain = domain(yMaxRaw);
  const sx = linear(0, xDomain.max, M.left, W - M.right);
  const sy = linear(0, yDomain.max, H - M.bottom, M.top);
  const fit = linearFit(shown.map((p) => ({ x: p.per10[x], y: p.per10[y] })));
  const roles = ROLE_ORDER.filter((r) => r !== "Unknown" || shown.some((p) => p.role === r));

  function choosePreset(key: string) {
    setPreset(key);
    const p = PRESETS.find((q) => q.key === key);
    if (p) { setX(p.x); setY(p.y); }
  }
  function chooseAxis(axis: "x" | "y", key: StatKey) {
    setPreset(CUSTOM);
    if (axis === "x") setX(key); else setY(key);
  }
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const { x: mx, y: my } = svgPoint(e);
    let best: { d: number; p: ScatterPoint } | null = null;
    for (const p of shown) {
      const d = Math.hypot(sx(p.per10[x]) - mx, sy(p.per10[y]) - my);
      if (d <= HOVER_RADIUS && (!best || d < best.d)) best = { d, p };
    }
    setHover(best ? best.p : null);
  }

  const xs = shown.map((p) => p.per10[x]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Preset">
          <Select value={preset} onChange={(e) => choosePreset(e.target.value)}>
            {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            <option value={CUSTOM}>Custom</option>
          </Select>
        </Field>
        <Field label="X axis">
          <Select value={x} onChange={(e) => chooseAxis("x", e.target.value as StatKey)}>
            {STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_LABELS[k]}</option>)}
          </Select>
        </Field>
        <Field label="Y axis">
          <Select value={y} onChange={(e) => chooseAxis("y", e.target.value as StatKey)}>
            {STAT_KEYS.map((k) => <option key={k} value={k}>{STAT_LABELS[k]}</option>)}
          </Select>
        </Field>
        <Field label="Hero">
          <Select value={activeHero} onChange={(e) => setHero(e.target.value)}>
            <option value="">All heroes</option>
            {heroes.map((h) => <option key={h} value={h}>{h}</option>)}
          </Select>
        </Field>
        <label htmlFor={trendId} className="flex items-center gap-2 py-1.5 text-sm text-muted">
          <input id={trendId} type="checkbox" checked={trend} onChange={(e) => setTrend(e.target.checked)} />
          Trend line
        </label>
      </div>
      <p className="text-xs text-muted">
        {!trend ? "Trend line off." : fit ? `Trend: r = ${fit.r.toFixed(2)} over ${fit.n} points` : `Trend line needs at least three points with different ${xLabel} values.`}
      </p>
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {roles.map((r) => (
          <span key={r} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3" style={{ background: ROLE_COLORS[r] }} aria-hidden />
            {r}
          </span>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState>No points for this hero in this range.</EmptyState>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${xLabel} against ${yLabel} per 10 minutes`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            <Axes yTicks={yDomain.ticks} yScale={sy} yFormat={formatPer10} xTicks={xDomain.ticks} xScale={sx} xFormat={formatPer10} />
            <clipPath id={clipId}>
              <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} />
            </clipPath>
            {trend && fit && (
              <g clipPath={`url(#${clipId})`}>
                <line x1={sx(x0)} y1={sy(fit.intercept + fit.slope * x0)} x2={sx(x1)} y2={sy(fit.intercept + fit.slope * x1)} stroke="var(--color-ink)" strokeWidth={1.5} strokeDasharray="4 3" />
              </g>
            )}
            {shown.map((p) => (
              <circle key={`${p.mapId}-${p.player}-${p.hero}`} cx={sx(p.per10[x])} cy={sy(p.per10[y])} r={4} fill={ROLE_COLORS[p.role]} fillOpacity={0.85} stroke="var(--color-surface)" strokeWidth={1.5} />
            ))}
            {hover && shown.includes(hover) && (
              <Tooltip x={sx(hover.per10[x])} y={sy(hover.per10[y])} lines={[
                `${hover.player} on ${hover.hero}`,
                `${hover.scrimName}, ${hover.scrimDate}, ${hover.mapName}`,
                `${xLabel}: ${formatPer10(hover.per10[x])}`,
                `${yLabel}: ${formatPer10(hover.per10[y])}`,
              ]} />
            )}
          </svg>
          <p className="text-xs text-muted">{xLabel} per 10 minutes across, {yLabel} per 10 minutes up.</p>
        </>
      )}
    </div>
  );
}
