"use client";

import { useMemo, useState } from "react";
import type { PlayerRow } from "@/lib/stats/overview";
import { formatDuration, formatInt } from "@/lib/format";

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
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return cmp * sort.dir;
    });
  }, [rows, hero, sort]);

  function toggle(key: SortKey) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  }

  return (
    <div className="space-y-2">
      <label className="text-sm">
        Hero filter{" "}
        <select value={hero} onChange={(e) => setHero(e.target.value)} className="rounded bg-zinc-900 px-2 py-1">
          <option value="">All heroes</option>
          {heroes.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400">
              <th className="px-2 py-1">Team</th>
              <th className="px-2 py-1 cursor-pointer" onClick={() => toggle("name")}>Player</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-1 cursor-pointer whitespace-nowrap" onClick={() => toggle(c.key)}>
                  {c.label}{sort?.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={`${r.team}-${r.name}-${r.hero}`} className={r.team === ourTeam ? "bg-zinc-900/60" : ""}>
                <td className="px-2 py-1 text-zinc-400">{r.team}</td>
                <td className="px-2 py-1 font-medium">{r.name}</td>
                {COLUMNS.map((c) => <td key={c.key} className="px-2 py-1 tabular-nums">{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
