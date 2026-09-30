"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/button";
import { Field, Select } from "@/components/field";
import type { HeatmapFilter } from "@/lib/heatmap-filters";
import { extraParams } from "@/lib/range";
import type { Sides } from "@/lib/stats/sides";

export interface StageOption {
  index: number;
  label: string;
}

export interface PlayerOption {
  key: string;
  label: string;
  side: "ours" | "theirs" | null;
}

/** GET form to the heatmap page; every unrelated query param (e.g. the replay's ?t=) rides along as a hidden input. */
export function HeatmapFilters({ stages, players, filter, sides }: { stages: StageOption[]; players: PlayerOption[]; filter: HeatmapFilter; sides: Sides }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const extra = extraParams(params, ["stage", "side", "player"]);
  const playerValue = filter.player ? `${filter.player.team}|${filter.player.name}` : "";
  return (
    <form key={params.toString()} method="get" action={pathname} className="flex flex-wrap items-end gap-3 text-sm">
      {extra.map(([k, v], i) => (
        <input key={i} type="hidden" name={k} value={v} />
      ))}
      {stages.length > 1 && (
        <Field label="Window">
          <Select name="stage" defaultValue={String(filter.stage)}>
            {stages.map((s) => (
              <option key={s.index} value={s.index}>{s.label}</option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Side">
        <Select name="side" defaultValue={filter.side}>
          <option value="both">Both</option>
          <option value="ours">{sides.ours}</option>
          <option value="theirs">{sides.theirs}</option>
        </Select>
      </Field>
      <Field label="Player">
        <Select name="player" defaultValue={playerValue}>
          <option value="">All</option>
          {(["ours", "theirs"] as const).map((side) => (
            <optgroup key={side} label={sides[side]}>
              {players.filter((p) => p.side === side).map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="primary">Apply</Button>
    </form>
  );
}
