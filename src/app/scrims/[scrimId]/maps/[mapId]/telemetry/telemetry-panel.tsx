"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Field, Select } from "@/components/field";
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
  if (!player) return <EmptyState>No player stats recorded.</EmptyState>;
  const color = TEAM_COLORS[player.side ?? "ours"];
  const opponentColor = TEAM_COLORS[player.side === "theirs" ? "ours" : "theirs"];
  const opponent = player.radar.opponent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-4">
        <Field label="Player">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ color }}>
            {(["ours", "theirs"] as const).map((side) => (
              <optgroup key={side} label={sides[side]}>
                {players.filter((p) => p.side === side).map((p) => (
                  <option key={key(p)} value={key(p)}>{p.name} ({p.hero})</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <div className="flex gap-x-3 text-sm text-muted">
          <span>{player.role}</span>
          <span>{formatDuration(player.timePlayed)} played</span>
        </div>
      </div>

      {hasDamage ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Damage dealt by hero"><LaneList lanes={player.dealt} color={color} /></Card>
          <Card title="Damage received by hero"><LaneList lanes={player.received} color={opponentColor} /></Card>
          <Card title="Focus fire received" note="Share of damage taken, by enemy role"><RoleBar shares={player.focusFire.received} color={opponentColor} /></Card>
          <Card title="Damage dealt, by enemy role"><RoleBar shares={player.focusFire.dealt} color={color} /></Card>
        </div>
      ) : (
        <EmptyState>Damage logging was off for this map. Turn on damage logging in the ScrimTime Workshop settings before hosting.</EmptyState>
      )}

      <Card title="Matchup radar" note={opponent ? `vs ${opponent.name} (${opponent.hero}), per 10 min` : "No enemy played this role"}>
        <Radar axes={player.radar.axes} playerLabel={player.name} opponentLabel={opponent?.name ?? null} playerColor={color} opponentColor={opponentColor} />
      </Card>
    </div>
  );
}

function LaneList({ lanes, color }: { lanes: Lane[]; color: string }) {
  if (lanes.length === 0) return <EmptyState>None recorded.</EmptyState>;
  return (
    <ul className="space-y-1 text-sm">
      {lanes.map((l) => (
        <li key={l.hero} className="flex items-center gap-2">
          <span className="w-28 truncate">{l.hero}</span>
          <span className="h-2 flex-1 rounded bg-raised">
            <span className="block h-2 rounded" style={{ width: `${Math.round(l.share * 100)}%`, background: color }} />
          </span>
          <span className="flex w-28 justify-end gap-x-2 tabular-nums text-muted">
            <span>{formatInt(l.damage)}</span>
            <span>{formatPct(l.share)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const roleOpacity = (i: number) => 1 - i * 0.22;

function RoleBar({ shares, color }: { shares: RoleShare[]; color: string }) {
  if (shares.every((s) => s.damage === 0)) return <EmptyState>None recorded.</EmptyState>;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex h-3 overflow-hidden rounded bg-raised">
        {shares.map((s, i) => (
          <span key={s.role} style={{ width: `${s.share * 100}%`, background: color, opacity: roleOpacity(i) }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-4 text-muted">
        {shares.map((s, i) => {
          if (s.damage === 0) return null;
          return (
            <li key={s.role} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color, opacity: roleOpacity(i) }} />
              {s.role} {formatPct(s.share)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
