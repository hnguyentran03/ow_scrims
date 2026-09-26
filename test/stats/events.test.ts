import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildEvents, findAjaxes, findMultikills, pairUltimates, type EventRows, type UltLike } from "@/lib/stats/events";
import { groupFights, type KillLike } from "@/lib/stats/fights";
import { parseLog } from "@/lib/parser/parse";

const map = { team1Name: "Team 1", team2Name: "Team 2", ourSide: 1, mapType: "Control" };
const kill = (matchTime: number, attackerName: string, victimName: string, extra: Partial<KillLike> = {}): KillLike => ({
  matchTime, attackerTeam: "Team 1", attackerName, attackerHero: "Sombra", victimTeam: "Team 2", victimName, victimHero: "Ana", ...extra,
});
const ult = (matchTime: number, playerName: string, playerHero: string | null = "Sombra", playerTeam = "Team 1"): UltLike => ({ matchTime, playerTeam, playerName, playerHero });
const empty: EventRows = { matchStarts: [], matchEnds: [], roundStarts: [], roundEnds: [], captures: [], swaps: [], ultStarts: [], ultEnds: [], kills: [] };

describe("pairUltimates", () => {
  it("drops a start followed by another start from the same player within one second", () => {
    const pairs = pairUltimates([ult(131.24, "YAI"), ult(131.64, "YAI"), ult(132.35, "F")], [ult(131.55, "YAI"), ult(142.38, "YAI")]);
    expect(pairs.map((p) => [p.start.matchTime, p.end?.matchTime ?? null])).toEqual([[131.64, 142.38], [132.35, null]]);
  });

  it("keeps a start with no end", () => {
    expect(pairUltimates([ult(10, "a")], [])).toEqual([{ start: ult(10, "a"), end: null }]);
  });
});

describe("findMultikills", () => {
  it("reports players with three or more counted kills in one fight", () => {
    const fights = groupFights([kill(1, "a", "x"), kill(2, "a", "y"), kill(3, "b", "x"), kill(4, "a", "z"), kill(100, "b", "x"), kill(101, "b", "y")]);
    expect(findMultikills(fights)).toEqual([{ team: "Team 1", player: "a", hero: "Sombra", kills: 3, time: 1, fightIndex: 1 }]);
  });
});

describe("findAjaxes", () => {
  it("matches a Lúcio death at the same time as the victim's ultimate end", () => {
    const kills = [kill(50, "a", "L", { victimHero: "Lúcio" }), kill(60, "a", "L", { victimHero: "Lúcio" }), kill(70, "a", "M", { victimHero: "Mercy" })];
    const ends = [ult(50, "L", "Lúcio", "Team 2"), ult(70, "M", null, "Team 2")];
    expect(findAjaxes(kills, ends)).toEqual([{ time: 50, team: "Team 2", player: "L" }]);
  });
});

describe("buildEvents", () => {
  it("returns no entries and zero totals for no rows", () => {
    expect(buildEvents(map, empty)).toEqual({ entries: [], totals: { rounds: 0, fights: 0, ults: 0, ultKills: 0, multikills: 0, swaps: 0, captures: 0 } });
  });

  it("drops lobby swaps and All Teams captures, and marks point captures on Control", () => {
    const rows: EventRows = {
      ...empty,
      swaps: [
        { matchTime: 0, playerTeam: "Team 1", playerName: "a", playerHero: "Ana", previousHero: "Kiriko" },
        { matchTime: 20, playerTeam: "Team 2", playerName: "b", playerHero: "Genji", previousHero: "Mei" },
      ],
      captures: [
        { matchTime: 44.9, roundNumber: 1, capturingTeam: "Team 1" },
        { matchTime: 60, roundNumber: 1, capturingTeam: "All Teams" },
      ],
    };
    const { entries, totals } = buildEvents(map, rows);
    expect(entries).toEqual([
      { kind: "swap", time: 20, team: "theirs", player: "b", from: "Mei", to: "Genji" },
      { kind: "capture", time: 44.9, team: "ours", teamName: "Team 1", isPoint: true },
    ]);
    expect(totals).toMatchObject({ swaps: 1, captures: 1 });
  });

  it("emits ults with kill counts, fights, and sorts boundaries before same-time events", () => {
    const rows: EventRows = {
      ...empty,
      matchStarts: [{ matchTime: 0 }],
      roundStarts: [{ matchTime: 0, roundNumber: 1 }],
      roundEnds: [{ matchTime: 100, roundNumber: 1, capturingTeam: "0", team1Score: 1, team2Score: 0 }],
      ultStarts: [ult(10, "a"), ult(90, "b", "Ana", "Team 2")],
      ultEnds: [ult(15, "a")],
      kills: [kill(11, "a", "x"), kill(12, "a", "y"), kill(90, "b", "z", { attackerTeam: "Team 2", victimTeam: "Team 1" })],
    };
    const { entries, totals } = buildEvents(map, rows);
    expect(entries.map((e) => `${e.time}:${e.kind}`)).toEqual([
      "0:match_start", "0:round_start", "10:ult", "10:ult_kill", "11:fight", "90:fight", "90:ult", "100:round_end",
    ]);
    expect(entries[2]).toEqual({ kind: "ult", time: 10, team: "ours", player: "a", hero: "Sombra", fightIndex: 1, kills: 2, conversionKills: 2, diedDuringUlt: false });
    expect(entries[3]).toEqual({ kind: "ult_kill", time: 10, team: "ours", player: "a", hero: "Sombra", kills: 2 });
    expect(entries[4]).toEqual({ kind: "fight", time: 11, team: "ours", fightIndex: 1, winner: "Team 1", ours: 2, theirs: 0 });
    expect(entries[6]).toMatchObject({ kind: "ult", kills: 0, conversionKills: 1, diedDuringUlt: false, fightIndex: 2 });
    expect(entries[7]).toEqual({ kind: "round_end", time: 100, team: "ours", roundNumber: 1, capturingTeam: "Team 1" });
    expect(totals).toEqual({ rounds: 1, fights: 2, ults: 2, ultKills: 1, multikills: 0, swaps: 0, captures: 0 });
  });

  it("does not count suicides or environmental kills toward ult kills", () => {
    const rows: EventRows = {
      ...empty,
      ultStarts: [ult(10, "a")],
      ultEnds: [ult(20, "a")],
      kills: [
        kill(11, "a", "x"),
        kill(12, "a", "a", { victimTeam: "Team 1" }),
        kill(13, "a", "y", { isEnvironmental: "True" }),
      ],
    };
    const { entries } = buildEvents(map, rows);
    expect(entries.find((e) => e.kind === "ult")).toMatchObject({ kills: 1 });
    const ultKills = entries.filter((e) => e.kind === "ult_kill");
    expect(ultKills).toHaveLength(1);
    expect(ultKills[0]).toMatchObject({ kills: 1 });
  });

  it("flags a caster who dies during their ult", () => {
    const rows: EventRows = {
      ...empty,
      ultStarts: [ult(10, "a")],
      ultEnds: [ult(20, "a")],
      kills: [kill(15, "z", "a", { attackerTeam: "Team 2", victimTeam: "Team 1" })],
    };
    const { entries } = buildEvents(map, rows);
    expect(entries.find((e) => e.kind === "ult")).toMatchObject({ kills: 0, conversionKills: 0, diedDuringUlt: true });
  });

  it("does not count suicides or environmental kills toward multikills", () => {
    const kills = [
      kill(1, "a", "x"),
      kill(2, "a", "y"),
      kill(3, "a", "z", { isEnvironmental: "True" }),
      kill(4, "b", "x"),
      kill(5, "b", "y"),
      kill(6, "b", "z"),
    ];
    const multikills = findMultikills(groupFights(kills));
    expect(multikills).toEqual([{ team: "Team 1", player: "b", hero: "Sombra", kills: 3, time: 4, fightIndex: 1 }]);
  });

  it("matches the Busan sample", () => {
    const parsed = parseLog(readFileSync("test/samples/Log-2023-12-12-22-15-10.txt", "utf8"));
    const rows = parsed.events as unknown as Record<string, unknown[]>;
    const { totals } = buildEvents(map, {
      matchStarts: rows.match_start as EventRows["matchStarts"],
      matchEnds: rows.match_end as EventRows["matchEnds"],
      roundStarts: rows.round_start as EventRows["roundStarts"],
      roundEnds: rows.round_end as EventRows["roundEnds"],
      captures: rows.objective_captured as EventRows["captures"],
      swaps: rows.hero_swap as EventRows["swaps"],
      ultStarts: rows.ultimate_start as EventRows["ultStarts"],
      ultEnds: rows.ultimate_end as EventRows["ultEnds"],
      kills: rows.kill as EventRows["kills"],
    });
    expect(totals).toEqual({ rounds: 3, fights: 23, ults: 51, ultKills: 12, multikills: 5, swaps: 25, captures: 15 });
  });
});
