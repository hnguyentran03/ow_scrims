import { describe, expect, it } from "vitest";
import { CONVERSION_WINDOW_SECONDS, casterKills, ultDetails, COMBO_WINDOW_SECONDS, COUNTER_WINDOW_SECONDS, ultCombos, counterUlts, ultAdvantageByFight } from "@/lib/stats/ult-analysis";
import type { KillLike } from "@/lib/stats/fights";
import type { UltLike } from "@/lib/stats/ultimates";
import { groupFights } from "@/lib/stats/fights";
import { sampleRows } from "./sample-rows";

const ult = (matchTime: number, playerName = "a", playerTeam = "Team 1", playerHero: string | null = "Mei"): UltLike => ({ matchTime, playerTeam, playerName, playerHero });
const kill = (matchTime: number, attackerName: string, victimName: string, extra: Partial<KillLike> = {}): KillLike => ({
  matchTime, attackerTeam: "Team 1", attackerName, attackerHero: "Mei", victimTeam: "Team 2", victimName, victimHero: "Ana", isEnvironmental: "0", ...extra,
});

describe("casterKills", () => {
  it("counts the caster's counted kills between start and end, and zero for an unpaired start", () => {
    const kills = [kill(11, "a", "x"), kill(12, "b", "y"), kill(13, "a", "a", { victimTeam: "Team 1" }), kill(21, "a", "z")];
    expect(casterKills(ult(10), ult(20), kills)).toBe(1);
    expect(casterKills(ult(10), null, kills)).toBe(0);
  });
});

describe("ultDetails", () => {
  it("counts team kills inside the conversion window inclusive of the boundary", () => {
    expect(CONVERSION_WINDOW_SECONDS).toBe(8);
    const kills = [kill(10, "b", "x"), kill(18, "c", "y"), kill(18.01, "a", "z"), kill(15, "e", "q", { attackerTeam: "Team 2", victimTeam: "Team 1" })];
    const [d] = ultDetails([ult(10)], [ult(12)], kills);
    expect(d.conversionKills).toBe(2);
    expect(d.casterKills).toBe(0);
  });

  it("ignores suicides and environmental kills in the window", () => {
    const kills = [kill(11, "a", "a", { victimTeam: "Team 1" }), kill(12, "b", "y", { isEnvironmental: "True" }), kill(13, "b", "z")];
    expect(ultDetails([ult(10)], [ult(20)], kills)[0].conversionKills).toBe(1);
  });

  it("flags a caster who dies between start and end, never for an unpaired start", () => {
    const death = kill(15, "e", "a", { attackerTeam: "Team 2", victimTeam: "Team 1" });
    expect(ultDetails([ult(10)], [ult(20)], [death])[0].diedDuringUlt).toBe(true);
    expect(ultDetails([ult(10)], [ult(14)], [death])[0].diedDuringUlt).toBe(false);
    expect(ultDetails([ult(10)], [], [death])[0].diedDuringUlt).toBe(false);
  });

  it("returns kept ults in cast order with their pairing", () => {
    const details = ultDetails([ult(30, "b"), ult(10), ult(10.5)], [ult(12)], []);
    expect(details.map((d) => [d.start.playerName, d.start.matchTime, d.end?.matchTime ?? null])).toEqual([["a", 10.5, 12], ["b", 30, null]]);
  });

  it("matches hand-counted values in the Antarctic sample", () => {
    const { starts, ends, kills } = sampleRows("Log-2026-04-15-21-12-58");
    const details = ultDetails(starts, ends, kills);
    expect(details).toHaveLength(28);
    const gray = details[0];
    expect([gray.start.playerName, gray.start.matchTime]).toEqual(["Gray", 102.57]);
    expect(gray).toMatchObject({ conversionKills: 2, casterKills: 0, diedDuringUlt: false });
    const vpal = details.find((d) => d.start.playerName === "VPAL" && d.start.matchTime === 155.86)!;
    expect(vpal).toMatchObject({ conversionKills: 2, casterKills: 1 });
    expect(details.filter((d) => d.diedDuringUlt).map((d) => `${d.start.playerName}@${d.start.matchTime}`)).toEqual(["Dyeonnie@213.28", "MomoMiles@413.08", "meowzy@480.48"]);
  });
});

describe("ultCombos", () => {
  it("chains same-team casts within the window and drops the pair that is one hundredth over", () => {
    expect(COMBO_WINDOW_SECONDS).toBe(5);
    const starts = [ult(10, "a"), ult(14, "b"), ult(19, "c"), ult(30, "d"), ult(35.01, "e"), ult(31, "x", "Team 2"), ult(33, "y", "Team 2")];
    const combos = ultCombos(starts, [], groupFights([kill(12, "a", "x")]));
    expect(combos.map((c) => [c.team, c.casts.map((x) => x.player), c.fightIndex])).toEqual([
      ["Team 1", ["a", "b", "c"], 1],
      ["Team 2", ["x", "y"], null],
    ]);
  });

  it("finds the four combos in the Antarctic sample", () => {
    const { starts, ends, kills } = sampleRows("Log-2026-04-15-21-12-58");
    const combos = ultCombos(starts, ends, groupFights(kills));
    expect(combos.map((c) => [c.team, c.casts.map((x) => `${x.player}@${x.time}`)])).toEqual([
      ["Team 1", ["VPAL@155.86", "Novadachi@157.38"]],
      ["Team 2", ["Dyeonnie@213.28", "StellBell@214.67"]],
      ["Team 2", ["meowzy@390.4", "sleepyme@391.92"]],
      ["Team 1", ["Gray@646.01", "Novadachi@646.78"]],
    ]);
  });
});

describe("counterUlts", () => {
  it("pairs a cast with the nearest preceding enemy cast, once each", () => {
    expect(COUNTER_WINDOW_SECONDS).toBe(5);
    const starts = [ult(10, "a"), ult(13, "x", "Team 2"), ult(14, "y", "Team 2"), ult(20, "b"), ult(26, "z", "Team 2")];
    const pairs = counterUlts(starts, []);
    expect(pairs.map((p) => [p.ult.player, p.answer.player, p.delaySeconds])).toEqual([["a", "x", 3]]);
  });

  it("finds the six answers in the Antarctic sample", () => {
    const { starts, ends } = sampleRows("Log-2026-04-15-21-12-58");
    const pairs = counterUlts(starts, ends);
    expect(pairs.map((p) => [p.ult.player, p.answer.player, Number(p.delaySeconds.toFixed(2))])).toEqual([
      ["meowzy", "MomoMiles", 3.27],
      ["MomoMiles", "Dyeonnie", 3.01],
      ["Kloverr", "sun", 4.9],
      ["VPAL", "StellBell", 0.48],
      ["MomoMiles", "Dyeonnie", 0.69],
      ["Novadachi", "StellBell", 0.37],
    ]);
    expect(pairs.filter((p) => p.answer.team === "Team 1")).toHaveLength(2);
  });
});

describe("ultAdvantageByFight", () => {
  const s = { ours: "Team 1", theirs: "Team 2" };
  const fightsAt = (...times: number[]) => groupFights(times.map((t, i) => kill(t, "a", `v${i}`)));

  it("returns null with no charge events", () => {
    expect(ultAdvantageByFight([], [ult(10)], [], fightsAt(20), s)).toBeNull();
  });

  it("counts a player as holding an ult after a charge and before the next cast, through flicker", () => {
    const charged = [ult(10), ult(11), ult(12), ult(30), ult(31)];
    const starts = [ult(20)];
    const result = ultAdvantageByFight(charged, starts, [], fightsAt(15, 45, 75), s)!;
    expect(result.fights.map((f) => [f.index, f.ours, f.theirs, f.advantage])).toEqual([[1, 1, 0, 1], [2, 1, 0, 1], [3, 1, 0, 1]]);
  });

  it("stops holding at a cast that shares the charge time, and counts enemies", () => {
    const charged = [ult(20), ult(5, "x", "Team 2")];
    const starts = [ult(20)];
    const result = ultAdvantageByFight(charged, starts, [], fightsAt(25), s)!;
    expect(result.fights[0]).toEqual({ index: 1, ours: 0, theirs: 1, advantage: -1, winner: "ours" });
  });

  it("summarises decided fights by ahead, even, and behind", () => {
    const charged = [ult(1, "a"), ult(1, "x", "Team 2")];
    const kills = [
      kill(10, "a", "v1"), kill(11, "x", "a", { attackerTeam: "Team 2", victimTeam: "Team 1" }),
      kill(100, "a", "v2"),
      kill(200, "x", "b", { attackerTeam: "Team 2", victimTeam: "Team 1" }),
    ];
    const result = ultAdvantageByFight(charged, [ult(50, "x", "Team 2")], [], groupFights(kills), s)!;
    expect(result.fights.map((f) => [f.advantage, f.winner])).toEqual([[0, null], [1, "ours"], [1, "theirs"]]);
    expect(result.summary).toEqual({ ahead: { fights: 2, won: 1 }, even: { fights: 0, won: 0 }, behind: { fights: 0, won: 0 } });
  });
});
