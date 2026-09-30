"use client";

import { useState, useTransition } from "react";
import { setMapWinnerAction } from "@/app/actions";
import { Button } from "@/components/button";
import { Field, Select } from "@/components/field";

export function WinnerControl(props: { scrimId: number; mapId: number; team1Name: string; team2Name: string; winnerSide: number | null; winnerSource: string | null }) {
  const [side, setSide] = useState<"1" | "2">(props.winnerSide === 2 ? "2" : "1");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = props.winnerSide === null ? "N/A" : props.winnerSide === 1 ? props.team1Name : props.team2Name;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await setMapWinnerAction(props.scrimId, props.mapId, side === "1" ? 1 : 2);
            setError(null);
          } catch {
            setError("Could not save the winner. Reload and try again.");
          }
        });
      }}
      className="flex flex-wrap items-end gap-3 text-base"
    >
      <span className="py-1.5 text-muted">
        Winner: {current}
        {props.winnerSource ? ` (${props.winnerSource})` : ""}
      </span>
      <Field label="Winner" error={error}>
        <Select value={side} onChange={(e) => setSide(e.target.value as "1" | "2")}>
          <option value="1">{props.team1Name}</option>
          <option value="2">{props.team2Name}</option>
        </Select>
      </Field>
      <Button type="submit" pending={pending} pendingLabel="Saving…">Set winner</Button>
    </form>
  );
}
