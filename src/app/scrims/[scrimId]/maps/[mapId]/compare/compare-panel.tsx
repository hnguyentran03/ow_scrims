"use client";

import { useMemo, useState } from "react";
import { TEAM_COLORS } from "@/lib/colors";
import { formatDuration, formatInt } from "@/lib/format";
import { compareStats, type ComparablePlayer, type CompareLine, type Selection } from "@/lib/stats/compare";
import type { PlayerRow } from "@/lib/stats/overview";
import type { Sides } from "@/lib/stats/sides";

const ALL = "";

export function ComparePanel({ players, options, sides }: { players: PlayerRow[]; options: ComparablePlayer[]; sides: Sides }) {
  const firstOurs = options.find((o) => o.team === sides.ours) ?? options[0];
  const firstTheirs = options.find((o) => o.team === sides.theirs) ?? options[1] ?? options[0];
  const [left, setLeft] = useState<Selection | null>(firstOurs ? { team: firstOurs.team, name: firstOurs.name } : null);
  const [right, setRight] = useState<Selection | null>(firstTheirs ? { team: firstTheirs.team, name: firstTheirs.name } : null);
  const lines = useMemo(() => (left && right ? compareStats(players, left, right) : []), [players, left, right]);

  if (options.length === 0) return <p className="text-sm text-zinc-400">No player stats recorded.</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector label="Left" options={options} value={left} onChange={setLeft} sides={sides} />
        <Selector label="Right" options={options} value={right} onChange={setRight} sides={sides} />
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-zinc-400">Pick two players to compare.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400">
              <th className="px-2 py-1">Stat</th>
              <th className="px-2 py-1 text-right">{left?.name}</th>
              <th className="px-2 py-1 text-right">{right?.name}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className="border-t border-zinc-800">
                <td className="px-2 py-1 text-zinc-400">{l.label}</td>
                <td className={`px-2 py-1 text-right tabular-nums ${l.better === "left" ? "font-semibold" : ""}`}>{render(l, l.left)}</td>
                <td className={`px-2 py-1 text-right tabular-nums ${l.better === "right" ? "font-semibold" : ""}`}>{render(l, l.right)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function render(line: CompareLine, value: number | string): string {
  if (typeof value === "string") return value;
  if (line.format === "duration") return formatDuration(value);
  if (line.format === "rate") return value.toFixed(1);
  return formatInt(value);
}

function Selector({ label, options, value, onChange, sides }: {
  label: string;
  options: ComparablePlayer[];
  value: Selection | null;
  onChange: (s: Selection) => void;
  sides: Sides;
}) {
  const key = (o: { team: string; name: string }) => `${o.team}|${o.name}`;
  const current = options.find((o) => value && key(o) === key(value));
  const color = current ? TEAM_COLORS[current.team === sides.ours ? "ours" : "theirs"] : undefined;
  return (
    <fieldset className="space-y-2 rounded border border-zinc-800 p-3">
      <legend className="px-1 text-xs uppercase tracking-wide text-zinc-500">{label}</legend>
      <label className="block text-sm">
        Player{" "}
        <select
          value={current ? key(current) : ""}
          onChange={(e) => {
            const picked = options.find((o) => key(o) === e.target.value);
            if (picked) onChange({ team: picked.team, name: picked.name });
          }}
          className="rounded bg-zinc-900 px-2 py-1"
          style={{ color }}
        >
          {options.map((o) => (
            <option key={key(o)} value={key(o)}>{o.name} ({o.team})</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Hero{" "}
        <select
          value={value?.hero ?? ALL}
          onChange={(e) => value && onChange({ ...value, hero: e.target.value === ALL ? undefined : e.target.value })}
          className="rounded bg-zinc-900 px-2 py-1"
        >
          <option value={ALL}>All heroes</option>
          {(current?.heroes ?? []).map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </label>
    </fieldset>
  );
}
