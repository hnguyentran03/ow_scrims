import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildKillfeed, type RezLike } from "@/lib/stats/killfeed";
import { CSV_HEADER, csvField, killfeedCsv } from "@/lib/stats/killfeed-csv";
import type { KillLike } from "@/lib/stats/fights";
import { parseLog } from "@/lib/parser/parse";

const map = { team1Name: "Team 1", team2Name: "Team 2", ourSide: 1 };
const kill = (matchTime: number, attackerName: string, victimName: string, extra: Partial<KillLike> = {}): KillLike => ({
  matchTime, attackerTeam: "Team 1", attackerName, attackerHero: "Ana", victimTeam: "Team 2", victimName, victimHero: "Genji", eventAbility: "Primary Fire",
  isCriticalHit: "0", isEnvironmental: "0", ...extra,
});
const rez = (matchTime: number): RezLike => ({
  matchTime, resurrecterTeam: "Team 2", resurrecterPlayer: "m", resurrecterHero: "Mercy", resurrecteeTeam: "Team 2", resurrecteePlayer: "g", resurrecteeHero: "Genji",
});
const roundEnd = (roundNumber: number, matchTime: number) => ({ roundNumber, matchTime, team1Score: roundNumber, team2Score: 0, capturingTeam: "Team 1" });
const HEADER = '"fight","round","time","kind","attacker_team","attacker","attacker_hero","victim_team","victim","victim_hero","method","critical"';

describe("csvField", () => {
  it("quotes everything and doubles inner quotes", () => {
    expect(csvField('Bob "The" Builder, Jr.')).toBe('"Bob ""The"" Builder, Jr."');
    expect(csvField(3)).toBe('"3"');
    expect(csvField(true)).toBe('"true"');
  });

  it("prefixes a leading apostrophe to defuse spreadsheet formula characters", () => {
    expect(csvField("=cmd|' /C calc'!A0")).toBe(`"'=cmd|' /C calc'!A0"`);
    expect(csvField("+1")).toBe(`"'+1"`);
    expect(csvField("-5")).toBe(`"'-5"`);
    expect(csvField("@x")).toBe(`"'@x"`);
    expect(csvField("Ana")).toBe('"Ana"');
  });
});

describe("killfeedCsv", () => {
  it("emits only the header for an empty killfeed, with CRLF endings", () => {
    expect(CSV_HEADER).toHaveLength(12);
    expect(killfeedCsv(buildKillfeed({ map, kills: [], rezzes: [], roundEnds: [], durationSeconds: 0 }))).toBe(`${HEADER}\r\n`);
  });

  it("writes one row per entry with fight and round, rez rows, and critical flags", () => {
    const kills = [kill(10, "a", "b", { isCriticalHit: "True" }), kill(14, "a", "d"), kill(100, "a", "c", { eventAbility: "0" })];
    const csv = killfeedCsv(buildKillfeed({ map, kills, rezzes: [rez(12)], roundEnds: [roundEnd(1, 50)], durationSeconds: 120 }));
    expect(csv.split("\r\n")).toEqual([
      HEADER,
      '"1","1","10.00","kill","Team 1","a","Ana","Team 2","b","Genji","Primary Fire","true"',
      '"1","1","12.00","rez","Team 2","m","Mercy","Team 2","g","Genji","Resurrect","false"',
      '"1","1","14.00","kill","Team 1","a","Ana","Team 2","d","Genji","Primary Fire","false"',
      '"2","2","100.00","kill","Team 1","a","Ana","Team 2","c","Genji","Unknown","false"',
      "",
    ]);
  });

  it("quotes a name with a comma and a quote", () => {
    const csv = killfeedCsv(buildKillfeed({ map, kills: [kill(10, 'Bob "The" Builder, Jr.', "b")], rezzes: [], roundEnds: [], durationSeconds: 10 }));
    expect(csv.split("\r\n")[1]).toContain('"Bob ""The"" Builder, Jr."');
  });

  it("prefixes an attacker name that looks like a spreadsheet formula", () => {
    const csv = killfeedCsv(buildKillfeed({ map, kills: [kill(10, '=HYPERLINK("x")', "b")], rezzes: [], roundEnds: [], durationSeconds: 10 }));
    expect(csv.split("\r\n")[1]).toBe('"1","1","10.00","kill","Team 1","\'=HYPERLINK(""x"")","Ana","Team 2","b","Genji","Primary Fire","false"');
  });

  it("labels a fight straddling a capture with the round in progress, not a contiguous count", () => {
    const kills = [kill(10, "a", "b"), kill(100, "a", "c")];
    const csv = killfeedCsv(buildKillfeed({ map, kills, rezzes: [], roundEnds: [roundEnd(2, 50)], durationSeconds: 120 }));
    expect(csv.split("\r\n")).toEqual([
      HEADER,
      '"1","2","10.00","kill","Team 1","a","Ana","Team 2","b","Genji","Primary Fire","false"',
      '"2","3","100.00","kill","Team 1","a","Ana","Team 2","c","Genji","Primary Fire","false"',
      "",
    ]);
  });

  it("marks a suicide with the attacker's team and name repeating the victim's", () => {
    const csv = killfeedCsv(buildKillfeed({ map, kills: [kill(10, "a", "a", { attackerTeam: "Team 1", victimTeam: "Team 1", victimName: "a" })], rezzes: [], roundEnds: [], durationSeconds: 10 }));
    expect(csv.split("\r\n")[1]).toBe('"1","1","10.00","suicide","Team 1","a","Ana","Team 1","a","Genji","Primary Fire","false"');
  });

  it("marks an environmental kill", () => {
    const csv = killfeedCsv(buildKillfeed({ map, kills: [kill(10, "a", "b", { isEnvironmental: "True" })], rezzes: [], roundEnds: [], durationSeconds: 10 }));
    expect(csv.split("\r\n")[1]).toBe('"1","1","10.00","environmental","Team 1","a","Ana","Team 2","b","Genji","Primary Fire","false"');
  });

  it("writes 58 rows for the Antarctic sample", () => {
    const ev = parseLog(readFileSync("test/samples/Log-2026-04-15-21-12-58.txt", "utf8")).events;
    const kills = (ev.kill ?? []) as unknown as KillLike[];
    const csv = killfeedCsv(buildKillfeed({ map, kills, rezzes: [], roundEnds: [], durationSeconds: 661.03 }));
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(60);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe('"1","1","28.43","kill","Team 2","sleepyme","Bastion","Team 1","MomoMiles","Orisa","Secondary Fire","false"');
  });
});
