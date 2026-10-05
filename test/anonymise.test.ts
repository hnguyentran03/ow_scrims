import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  DEFAULT_TEAM_LABELS, OTHER_TEXT_COLUMNS, PLAYER_COLUMNS, SENTINELS, TEAM_COLUMNS,
  extendAliasMap, isSkipped, pseudonym, rewriteScrimName, type AliasMap,
} from "@/lib/anonymise";

function seeded(seed = 1) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

describe("pseudonym", () => {
  it("keeps the first character and case, is lower-case pronounceable after it, 5–9 chars", () => {
    for (const real of ["HaveBlue", "sterilite", "Zed", "x", "Émile"]) {
      const p = pseudonym(real, new Set(), seeded());
      expect(p[0]).toBe(real[0]);
      expect(p.slice(1)).toMatch(/^[a-z]+$/);
      expect(p.length).toBeGreaterThanOrEqual(5);
      expect(p.length).toBeLessThanOrEqual(9);
    }
  });
  it("keeps a non-letter first character", () => {
    expect(pseudonym("7up", new Set(), seeded())[0]).toBe("7");
  });
  it("never returns a taken value, compared case-insensitively", () => {
    const rnd = seeded(3);
    const first = pseudonym("Ben", new Set(), seeded(3));
    const second = pseudonym("Ben", new Set([first.toUpperCase()]), rnd);
    expect(second.toLowerCase()).not.toBe(first.toLowerCase());
  });
});

describe("extendAliasMap", () => {
  it("adds only new names, keeps existing pseudonyms, and skips sentinels and default labels", () => {
    const map: AliasMap = { names: { HaveBlue: "Hodura" } };
    const reals = ["HaveBlue", "Ben", "Zed", "0", "Team 1"];
    const { added } = extendAliasMap(map, reals, seeded());
    expect(map.names.HaveBlue).toBe("Hodura");
    expect(Object.keys(added).sort()).toEqual(["Ben", "Zed"]);
    expect(Object.keys(map.names).sort()).toEqual(["Ben", "HaveBlue", "Zed"]);
    const lower = Object.values(map.names).map((s) => s.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);                       // no two reals share a pseudonym
    for (const p of lower) expect(reals.map((r) => r.toLowerCase())).not.toContain(p);   // no pseudonym equals a real name
  });
  it("never hands out a pseudonym that equals another real name", () => {
    const map: AliasMap = { names: {} };
    // "Bolari" is both a plausible generated tail and a real name in this roster; the generator must avoid it.
    extendAliasMap(map, ["Ben", "Bolari"], seeded(7));
    expect(map.names.Ben.toLowerCase()).not.toBe("bolari");
    expect(map.names.Bolari.toLowerCase()).not.toBe("bolari");
  });
  it("materialises a one-shot iterator so both reals get added", () => {
    const map: AliasMap = { names: {} };
    const gen = (function* () {
      yield "Ben";
      yield "Zed";
    })();
    const { added } = extendAliasMap(map, gen, seeded());
    expect(Object.keys(added).sort()).toEqual(["Ben", "Zed"]);
    expect(Object.keys(map.names).sort()).toEqual(["Ben", "Zed"]);
  });
});

describe("rewriteScrimName", () => {
  const map: AliasMap = { names: { Ben: "Bolari", Benji: "Bituva", "Team Rocket": "Tanoke" } };
  it("replaces longest names first, case-insensitively, as plain substrings", () => {
    expect(rewriteScrimName("vs Team Rocket (Benji carried, ben too)", map)).toBe("vs Tanoke (Bituva carried, Bolari too)");
  });
  it("leaves a name-free scrim name alone", () => {
    expect(rewriteScrimName("Scrim 3", map)).toBe("Scrim 3");
  });
  it("replaces in a single pass, so a short name inside an inserted pseudonym is not re-substituted", () => {
    const overlap: AliasMap = { names: { Ben: "Bolari", lar: "Lumo" } };
    expect(rewriteScrimName("Ben and lar", overlap)).toBe("Bolari and Lumo");
  });
});

describe("skips", () => {
  it("names sentinels and default team labels", () => {
    expect(SENTINELS).toEqual(["0", ""]);
    expect(DEFAULT_TEAM_LABELS).toEqual(["Team 1", "Team 2"]);
    for (const v of ["0", "", "Team 1", "Team 2"]) expect(isSkipped(v)).toBe(true);
    expect(isSkipped("Team 3")).toBe(false);
  });
});

describe("column classification", () => {
  it("puts every text column of the schema in exactly one list", () => {
    const seen: string[] = [];
    for (const t of Object.values(schema)) {
      if (typeof t !== "object" || t === null || !isTable(t)) continue;
      const name = getTableName(t as never);
      for (const [, col] of Object.entries(getTableColumns(t as never))) {
        if ((col as { columnType?: string }).columnType !== "PgText") continue;
        seen.push(`${name}.${(col as { name: string }).name}`);
      }
    }
    const key = (c: { table: string; column: string }) => `${c.table}.${c.column}`;
    const classified = [...PLAYER_COLUMNS, ...TEAM_COLUMNS, ...OTHER_TEXT_COLUMNS].map(key);
    expect(new Set(classified).size).toBe(classified.length);          // no column in two lists
    expect(classified.sort()).toEqual([...new Set(seen)].sort());      // none missing, none extra
    expect(PLAYER_COLUMNS).toHaveLength(22);
    expect(TEAM_COLUMNS).toHaveLength(5);
  });
});
