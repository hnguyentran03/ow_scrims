import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseLog } from "@/lib/parser/parse";
import { ParseError } from "@/lib/parser/errors";

export const sample = (name: string) => readFileSync(`test/samples/${name}.txt`, "utf8");

const CASES: Array<[string, number, number]> = [
  ["Log-2023-12-12-22-15-10", 114, 90],
  ["Log-2024-01-10-20-38-42", 31, 30],
  ["Log-2024-01-22-20-02-45", 84, 47],
  ["Log-2024-01-22-20-21-43", 97, 45],
  ["Log-2024-01-22-21-35-38", 76, 72],
  ["Log-2024-02-05-20-07-38", 91, 92],
  ["Log-2024-05-03-20-06-06", 73, 90],
  ["Log-2024-06-16-22-24-33", 90, 49],
  ["Log-2026-04-02-17-21-48", 80, 73],
  ["Log-2026-04-15-21-12-58", 58, 40],
];

describe("parseLog on real logs", () => {
  it.each(CASES)("%s parses with expected kill and player_stat counts", (name, kills, stats) => {
    const parsed = parseLog(sample(name));
    expect(parsed.events.kill).toHaveLength(kills);
    expect(parsed.events.player_stat).toHaveLength(stats);
    expect(parsed.events.match_start).toHaveLength(1);
    expect(parsed.events.match_end).toHaveLength(1);
    expect(parsed.warnings).toEqual([]);
  });

  it("keeps every line of the censored Antarctic log", () => {
    const parsed = parseLog(sample("Log-2026-04-15-21-12-58"));
    const total = Object.values(parsed.events).reduce((n, rows) => n + (rows?.length ?? 0), 0);
    expect(total).toBe(310);
  });

  it("parses the high-volume positional log", () => {
    const parsed = parseLog(sample("Log-2026-04-02-17-21-48"));
    expect(parsed.events.healing).toHaveLength(11648);
    expect(parsed.events.damage).toHaveLength(4350);
    expect(parsed.events.ability_1_used).toHaveLength(532);
    expect(parsed.events.kill?.[0].attackerPosition).toMatch(/^\(/);
  });
});

describe("parseLog rejections", () => {
  const good = sample("Log-2026-04-15-21-12-58");

  it("rejects files under 1KB", () => {
    expect(() => parseLog(good.slice(0, 500))).toThrow(/1KB/);
  });

  it("rejects a log with no match_start", () => {
    const text = good.split("\n").filter((l) => !l.includes(",match_start,")).join("\n");
    expect(() => parseLog(text)).toThrow(/match_start/);
  });

  it("rejects a log with two match_start lines", () => {
    const first = good.split("\n")[0];
    expect(() => parseLog(`${first}\n${good}`)).toThrow(/match_start/);
  });

  it("rejects a log with no match_end", () => {
    const text = good.split("\n").filter((l) => !l.includes(",match_end,")).join("\n");
    expect(() => parseLog(text)).toThrow(/match_end/);
  });

  it("collects unknown event types as warnings instead of failing", () => {
    // `good` already ends with a newline, so this becomes line 311.
    const text = `${good}[00:20:04] ,future_event,1,2,3\n`;
    const parsed = parseLog(text);
    expect(parsed.warnings).toEqual(["line 311: unknown event type future_event"]);
  });

  it("reports the line number of a malformed known event", () => {
    const text = good.replace(",match_end,661.03,3,3,0", ",match_end,661.03,three,3,0");
    expect(() => parseLog(text)).toThrow(ParseError);
    expect(() => parseLog(text)).toThrow(/line 299/);
  });
});
