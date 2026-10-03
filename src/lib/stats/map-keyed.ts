/** A row that belongs to one map. Kept in its own leaf module so `fights.ts` can group by map without importing `team-rows.ts`. */
export interface MapKeyed {
  mapId: number;
}

export function groupByMap<T extends MapKeyed>(rows: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const row of rows) {
    const list = out.get(row.mapId) ?? [];
    list.push(row);
    out.set(row.mapId, list);
  }
  return out;
}
