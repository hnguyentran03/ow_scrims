import { buildRoster } from "./roster";
import { sides } from "./sides";
import { finalsByMap, outcome, rate, type StatLike, type TeamMapLike } from "./team-rows";
import { winRateByMap, type MapRecord } from "./trends";

export interface MatrixCell {
  played: number;
  won: number;
  lost: number;
  undecided: number;
  winRate: number | null;
}

export interface MatrixRow {
  name: string;
  /** Aligned with `columns`; null where the player never had time on that map. */
  cells: (MatrixCell | null)[];
}

export interface PlayerMapMatrix {
  columns: MapRecord[];
  rows: MatrixRow[];
}

/** Each of our players' record per map, rows in roster order and columns in the trends table's order. */
export function playerMapMatrix(maps: TeamMapLike[], playerStats: StatLike[]): PlayerMapMatrix {
  const columns = winRateByMap(maps);
  const columnIndex = new Map(columns.map((c, i) => [c.mapName, i]));
  const finals = finalsByMap(playerStats);
  const cells = new Map<string, (MatrixCell | null)[]>();

  for (const m of maps) {
    const ours = sides(m).ours;
    const column = columnIndex.get(m.mapName)!;
    const names = new Set((finals.get(m.id) ?? []).filter((r) => r.playerTeam === ours && r.heroTimePlayed > 0).map((r) => r.playerName));
    for (const name of names) {
      const row = cells.get(name) ?? columns.map(() => null);
      const cell = row[column] ?? { played: 0, won: 0, lost: 0, undecided: 0, winRate: null };
      cell.played += 1;
      cell[outcome(m)] += 1;
      cell.winRate = rate(cell.won, cell.won + cell.lost);
      row[column] = cell;
      cells.set(name, row);
    }
  }

  const rows = buildRoster(maps, playerStats).map((r) => ({ name: r.name, cells: cells.get(r.name) ?? columns.map(() => null) }));
  return { columns, rows };
}
