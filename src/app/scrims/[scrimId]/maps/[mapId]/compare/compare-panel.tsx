"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Field, Select } from "@/components/field";
import { Table, Td, Th } from "@/components/table";
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

  if (options.length === 0) return <EmptyState>No player stats recorded.</EmptyState>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Selector label="Left" options={options} value={left} onChange={setLeft} sides={sides} />
        <Selector label="Right" options={options} value={right} onChange={setRight} sides={sides} />
      </div>
      {lines.length === 0 ? (
        <EmptyState>Pick two players to compare.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Stat</Th>
              <Th numeric>{left?.name}</Th>
              <Th numeric>{right?.name}</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.label}>
                <Td muted>{l.label}</Td>
                <Td numeric className={l.better === "left" ? "font-semibold" : ""}>{render(l, l.left)}</Td>
                <Td numeric className={l.better === "right" ? "font-semibold" : ""}>{render(l, l.right)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
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
    <fieldset className="space-y-2 rounded-card border border-line bg-surface p-3">
      <legend className="px-1 text-sm text-muted">{label}</legend>
      <Field label="Player">
        <Select
          value={current ? key(current) : ""}
          onChange={(e) => {
            const picked = options.find((o) => key(o) === e.target.value);
            if (picked) onChange({ team: picked.team, name: picked.name });
          }}
          style={{ color }}
        >
          {options.map((o) => (
            <option key={key(o)} value={key(o)}>{o.name} ({o.team})</option>
          ))}
        </Select>
      </Field>
      <Field label="Hero">
        <Select
          value={value?.hero ?? ALL}
          onChange={(e) => value && onChange({ ...value, hero: e.target.value === ALL ? undefined : e.target.value })}
        >
          <option value={ALL}>All heroes</option>
          {(current?.heroes ?? []).map((h) => <option key={h} value={h}>{h}</option>)}
        </Select>
      </Field>
    </fieldset>
  );
}
