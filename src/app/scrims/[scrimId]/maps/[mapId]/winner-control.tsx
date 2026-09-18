"use client";

import { useState, useTransition } from "react";
import { setMapWinnerAction } from "@/app/actions";

export function WinnerControl(props: {
  scrimId: number;
  mapId: number;
  team1Name: string;
  team2Name: string;
  winnerSide: number | null;
  winnerSource: string | null;
}) {
  const [side, setSide] = useState<"1" | "2">(props.winnerSide === 2 ? "2" : "1");
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(() => setMapWinnerAction(props.scrimId, props.mapId, side === "1" ? 1 : 2));
      }}
      className="flex items-center gap-2 text-sm"
    >
      <span className="text-zinc-400">
        Winner: {props.winnerSide === null ? "N/A" : props.winnerSide === 1 ? props.team1Name : props.team2Name}
        {props.winnerSource ? ` (${props.winnerSource})` : ""}
      </span>
      <select value={side} onChange={(e) => setSide(e.target.value as "1" | "2")} className="rounded bg-zinc-900 px-2 py-1">
        <option value="1">{props.team1Name}</option>
        <option value="2">{props.team2Name}</option>
      </select>
      <button type="submit" disabled={pending} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-50">
        Set winner
      </button>
    </form>
  );
}
