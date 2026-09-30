"use client";

import { useMemo, useState } from "react";
import type { PlayerRow } from "@/lib/stats/overview";
import { formatDuration, formatInt } from "@/lib/format";
import { Field, Select } from "@/components/field";
import { Table, Td, Th } from "@/components/table";
import { compareBy } from "@/lib/sort";

type NumericKey = Exclude<keyof PlayerRow, "team" | "name" | "hero" | "role">;
type SortKey = "name" | "hero" | NumericKey;

const COLUMNS: Array<{ key: SortKey; label: string; render: (r: PlayerRow) => string }> = [
  { key: "hero", label: "Hero", render: (r) => r.hero },
  { key: "timePlayed", label: "Time", render: (r) => formatDuration(r.timePlayed) },
  { key: "eliminations", label: "Elims", render: (r) => formatInt(r.eliminations) },
  { key: "finalBlows", label: "FB", render: (r) => formatInt(r.finalBlows) },
  { key: "deaths", label: "Deaths", render: (r) => formatInt(r.deaths) },
  { key: "heroDamage", label: "Hero dmg", render: (r) => formatInt(r.heroDamage) },
  { key: "healing", label: "Healing", render: (r) => formatInt(r.healing) },
  { key: "damageTaken", label: "Dmg taken", render: (r) => formatInt(r.damageTaken) },
  { key: "damageBlocked", label: "Blocked", render: (r) => formatInt(r.damageBlocked) },
  { key: "ultsEarned", label: "Ults", render: (r) => formatInt(r.ultsEarned) },
  { key: "ultsUsed", label: "Used", render: (r) => formatInt(r.ultsUsed) },
  { key: "elimsPer10", label: "E/10", render: (r) => r.elimsPer10.toFixed(1) },
  { key: "fbPer10", label: "FB/10", render: (r) => r.fbPer10.toFixed(1) },
  { key: "deathsPer10", label: "D/10", render: (r) => r.deathsPer10.toFixed(1) },
  { key: "damagePer10", label: "Dmg/10", render: (r) => formatInt(r.damagePer10) },
  { key: "healingPer10", label: "Heal/10", render: (r) => formatInt(r.healingPer10) },
];

export function StatTable({ rows, ourTeam }: { rows: PlayerRow[]; ourTeam: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [hero, setHero] = useState("");

  const heroes = useMemo(() => [...new Set(rows.map((r) => r.hero))].sort(), [rows]);

  const visible = useMemo(() => {
    const filtered = hero ? rows.filter((r) => r.hero === hero) : rows;
    return sort ? [...filtered].sort(compareBy<PlayerRow>(sort.key, sort.dir)) : filtered;
  }, [rows, hero, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  const sortFor = (key: SortKey) => ({ active: sort?.key === key, dir: sort?.key === key ? sort.dir : (-1 as const), onToggle: () => toggle(key) });

  return (
    <div className="space-y-3">
      <Field label="Hero filter">
        <Select value={hero} onChange={(e) => setHero(e.target.value)}>
          <option value="">All heroes</option>
          {heroes.map((h) => <option key={h} value={h}>{h}</option>)}
        </Select>
      </Field>
      <Table>
        <thead>
          <tr>
            <Th pin="first">Team</Th>
            <Th pin="second" sort={sortFor("name")}>Player</Th>
            {COLUMNS.map((c) => (
              <Th key={c.key} numeric={c.key !== "hero"} sort={sortFor(c.key)}>{c.label}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={`${r.team}-${r.name}-${r.hero}`} className={r.team === ourTeam ? "bg-ours/8" : ""}>
              <Td pin="first" tint={r.team === ourTeam} muted>{r.team}</Td>
              <Td pin="second" tint={r.team === ourTeam} className="font-medium">{r.name}</Td>
              {COLUMNS.map((c) => <Td key={c.key} numeric={c.key !== "hero"}>{c.render(r)}</Td>)}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
