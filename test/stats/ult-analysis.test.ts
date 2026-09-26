import { describe, expect, it } from "vitest";
import { CONVERSION_WINDOW_SECONDS, casterKills, ultDetails } from "@/lib/stats/ult-analysis";
import type { KillLike } from "@/lib/stats/fights";
import type { UltLike } from "@/lib/stats/ultimates";
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
