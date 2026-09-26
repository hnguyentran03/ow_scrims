"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { TEAM_COLORS } from "@/lib/colors";
import { formatDuration, formatInt, formatPct } from "@/lib/format";
import type { Sides } from "@/lib/stats/sides";
import type { Lane, RoleShare, Telemetry } from "@/lib/stats/telemetry";
import { Radar } from "./radar";

const key = (p: { team: string; name: string }) => `${p.team}|${p.name}`;

export function TelemetryPanel({ telemetry, sides }: { telemetry: Telemetry; sides: Sides }) {
  const { players, hasDamage } = telemetry;
  const [selected, setSelected] = useState(players[0] ? key(players[0]) : "");
  const player = players.find((p) => key(p) === selected);
  if (!player) return <p className="text-sm text-zinc-400">No player stats recorded.</p>;
  const color = TEAM_COLORS[player.side ?? "ours"];
  const opponentColor = TEAM_COLORS[player.side === "theirs" ? "ours" : "theirs"];
  const opponent = player.radar.opponent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-4">
        <label className="text-sm">
          Player{" "}
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded bg-zinc-900 px-2 py-1" style={{ color }}>
            {(["ours", "theirs"] as const).map((side) => (
              <optgroup key={side} label={sides[side]}>
                {players.filter((p) => p.side === side).map((p) => (
                  <option key={key(p)} value={key(p)}>{p.name} ({p.hero})</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <span className="text-sm text-zinc-400">{player.role} · {formatDuration(player.timePlayed)} played</span>
      </div>

      {hasDamage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Damage dealt by hero"><LaneList lanes={player.dealt} color={color} /></Card>
          <Card title="Damage received by hero"><LaneList lanes={player.received} color={opponentColor} /></Card>
          <Card title="Focus fire received" note="Share of damage taken, by enemy role"><RoleBar shares={player.focusFire.received} color={opponentColor} /></Card>
          <Card title="Damage dealt by enemy role"><RoleBar shares={player.focusFire.dealt} color={color} /></Card>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Damage logging was off for this map. Turn on damage logging in the ScrimTime Workshop settings before hosting.</p>
      )}

      <Card title="Matchup radar" note={opponent ? `vs ${opponent.name} (${opponent.hero}) · per 10 min` : "No enemy played this role"}>
        <Radar axes={player.radar.axes} playerLabel={player.name} opponentLabel={opponent?.name ?? null} playerColor={color} opponentColor={opponentColor} />
      </Card>
    </div>
  );
}

function LaneList({ lanes, color }: { lanes: Lane[]; color: string }) {
  if (lanes.length === 0) return <p className="text-sm text-zinc-400">None.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {lanes.map((l) => (
        <li key={l.hero} className="flex items-center gap-2">
          <span className="w-28 truncate">{l.hero}</span>
          <span className="h-2 flex-1 rounded bg-zinc-800">
            <span className="block h-2 rounded" style={{ width: `${Math.round(l.share * 100)}%`, background: color }} />
          </span>
          <span className="w-28 text-right tabular-nums text-zinc-400">{formatInt(l.damage)} · {formatPct(l.share)}</span>
        </li>
      ))}
    </ul>
  );
}

function RoleBar({ shares, color }: { shares: RoleShare[]; color: string }) {
  if (shares.every((s) => s.damage === 0)) return <p className="text-sm text-zinc-400">None.</p>;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex h-3 overflow-hidden rounded bg-zinc-800">
        {shares.map((s, i) => (
          <span key={s.role} style={{ width: `${s.share * 100}%`, background: color, opacity: 1 - i * 0.22 }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-4 text-zinc-400">
        {shares.filter((s) => s.damage > 0).map((s) => <li key={s.role}>{s.role} {formatPct(s.share)}</li>)}
      </ul>
    </div>
  );
}
