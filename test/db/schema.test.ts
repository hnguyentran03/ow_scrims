import { describe, expect, it } from "vitest";
import { getTableColumns, sql } from "drizzle-orm";
import { EVENTS, EVENT_TYPES, type EventColumn } from "@/lib/parser/events";
import { EVENT_TABLES, maps, scrims } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db";

describe("schema", () => {
  it("has a table per event whose columns match the descriptors in order", () => {
    for (const type of EVENT_TYPES) {
      const cols = getTableColumns(EVENT_TABLES[type]) as Record<string, { name: string; notNull: boolean }>;
      const keys = Object.keys(cols).filter((k) => k !== "id" && k !== "mapId");
      const descriptors = EVENTS[type] as readonly EventColumn[];
      expect(keys, type).toEqual(descriptors.map((c) => c.key));
      for (const c of descriptors) {
        expect(cols[c.key].name, `${type}.${c.key}`).toBe(c.column);
        expect(cols[c.key].notNull, `${type}.${c.key} nullability`).toBe(!(c.optional || c.nullable));
      }
    }
  });

  it("migrates an in-memory database with 29 public tables", async () => {
    const db = await createTestDb();
    const result = await db.execute(sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
    expect((result.rows[0] as { n: number }).n).toBe(29);
    expect(getTableColumns(scrims).opponentName.name).toBe("opponent_name");
    expect(getTableColumns(maps).ourSide.name).toBe("our_side");
  });
});
