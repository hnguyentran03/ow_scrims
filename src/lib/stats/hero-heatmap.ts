import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { sides } from "./sides";
import { finalsByMap, rate, type StatLike, type TeamMapLike } from "./team-rows";

export interface HeatmapColumn {
  scrimId: number;
  date: string;
  name: string;
  maps: number;
}

export interface HeatmapCell {
  picks: number;
  maps: number;
  share: number | null;
}

export interface HeatmapRow {
  hero: string;
  role: Role;
  total: number;
  cells: HeatmapCell[];
}

export interface HeroHeatmap {
  columns: HeatmapColumn[];
  rows: HeatmapRow[];
}

const roleRank = (role: Role) => ROLE_ORDER.indexOf(role);

/** Heroes our side played, by scrim: a cell is the share of that scrim's maps where anyone on our side had time on the hero. */
export function heroPickHeatmap(maps: TeamMapLike[], playerStats: StatLike[]): HeroHeatmap {
  const columns: HeatmapColumn[] = [];
  const columnIndex = new Map<number, number>();
  for (const m of maps) {
    let i = columnIndex.get(m.scrimId);
    if (i === undefined) {
      i = columns.length;
      columnIndex.set(m.scrimId, i);
      columns.push({ scrimId: m.scrimId, date: m.scrimDate, name: m.scrimName, maps: 0 });
    }
    columns[i].maps += 1;
  }

  const finals = finalsByMap(playerStats);
  const picks = new Map<string, number[]>();
  for (const m of maps) {
    const ours = sides(m).ours;
    const column = columnIndex.get(m.scrimId)!;
    const heroes = new Set((finals.get(m.id) ?? []).filter((r) => r.playerTeam === ours && r.heroTimePlayed > 0).map((r) => r.playerHero));
    for (const hero of heroes) {
      const counts = picks.get(hero) ?? new Array<number>(columns.length).fill(0);
      counts[column] += 1;
      picks.set(hero, counts);
    }
  }

  const rows = [...picks]
    .map(([hero, counts]) => ({
      hero,
      role: roleOf(hero),
      total: counts.reduce((a, b) => a + b, 0),
      cells: columns.map((c, i) => ({ picks: counts[i], maps: c.maps, share: rate(counts[i], c.maps) })),
    }))
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || b.total - a.total || a.hero.localeCompare(b.hero));
  return { columns, rows };
}
