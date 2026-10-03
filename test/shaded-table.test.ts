import { describe, expect, it } from "vitest";
import { matrixToShaded } from "@/app/team/players/player-map-matrix-table";
import { heatmapToShaded } from "@/app/team/trends/hero-heatmap-table";
import type { HeroHeatmap } from "@/lib/stats/hero-heatmap";
import type { PlayerMapMatrix } from "@/lib/stats/player-map-matrix";

const heatmap: HeroHeatmap = {
  columns: [
    { scrimId: 7, date: "2026-09-11", name: "vs Alpha", maps: 2 },
    { scrimId: 8, date: "2026-09-12", name: "vs Beta", maps: 4 },
  ],
  rows: [
    {
      hero: "Ana",
      role: "Support",
      total: 1,
      cells: [
        { picks: 1, maps: 2, share: 0.5 },
        { picks: 0, maps: 4, share: 0 },
      ],
    },
  ],
};

const matrix: PlayerMapMatrix = {
  columns: [
    { mapName: "Busan", mapType: "Control", played: 2, won: 1, lost: 1, undecided: 0, winRate: 0.5 },
    { mapName: "Ilios", mapType: "Control", played: 1, won: 0, lost: 0, undecided: 1, winRate: null },
  ],
  rows: [
    {
      name: "P",
      cells: [
        { played: 2, won: 1, lost: 1, undecided: 0, winRate: 0.5 },
        null,
      ],
    },
    {
      name: "Q",
      cells: [
        null,
        { played: 1, won: 0, lost: 0, undecided: 1, winRate: null },
      ],
    },
  ],
};

describe("heatmapToShaded", () => {
  it("names columns by date and titles them with the scrim name", () => {
    expect(heatmapToShaded(heatmap).columns).toEqual([
      { key: "7", label: "2026-09-11", title: "vs Alpha" },
      { key: "8", label: "2026-09-12", title: "vs Beta" },
    ]);
  });

  it("shades a cell by its share, shows the pick count in the title, and mutes a hero never picked", () => {
    const [row] = heatmapToShaded(heatmap).rows;
    expect(row).toEqual({
      key: "Ana",
      label: "Ana",
      title: "Ana, Support",
      cells: [
        { value: 0.5, text: "50%", title: "1 of 2 maps", muted: false },
        { value: 0, text: "0%", title: "0 of 4 maps", muted: true },
      ],
    });
  });
});

describe("matrixToShaded", () => {
  it("names columns by map and titles them with the map type", () => {
    expect(matrixToShaded(matrix).columns).toEqual([
      { key: "Busan", label: "Busan", title: "Control" },
      { key: "Ilios", label: "Ilios", title: "Control" },
    ]);
  });

  it("shades a cell by win rate and leaves an unplayed map null", () => {
    expect(matrixToShaded(matrix).rows).toEqual([
      {
        key: "P",
        label: "P",
        cells: [{ value: 0.5, text: "1-1", title: "1-1, 50%" }, null],
      },
      {
        key: "Q",
        label: "Q",
        cells: [null, { value: null, text: "0-0", title: "0-0, 1 undecided, –" }],
      },
    ]);
  });
});
