import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildKillfeed, UNKNOWN_METHOD, type RezLike } from "@/lib/stats/killfeed";
import type { KillLike } from "@/lib/stats/fights";
import { parseLog } from "@/lib/parser/parse";

const map = { team1Name: "Team 1", team2Name: "Team 2", ourSide: 2 };
const kill = (matchTime: number, attackerTeam: string, attackerName: string, victimTeam: string, victimName: string, extra: Partial<KillLike> = {}): KillLike => ({
  matchTime, attackerTeam, attackerName, victimTeam, victimName, attackerHero: "Ana", victimHero: "Genji", eventAbility: "Primary Fire",
  isCriticalHit: "0", isEnvironmental: "0", ...extra,
});
const rez = (matchTime: number, resurrecteePlayer: string): RezLike => ({
  matchTime, resurrecterTeam: "Team 1", resurrecterPlayer: "m", resurrecterHero: "Mercy", resurrecteeTeam: "Team 1", resurrecteePlayer, resurrecteeHero: "Genji",
});
const roundEnd = (roundNumber: number, matchTime: number, team1Score: number, team2Score: number) => ({ roundNumber, matchTime, team1Score, team2Score, capturingTeam: "0" });

describe("buildKillfeed", () => {
  it("returns an empty killfeed for no kills", () => {
    const kf = buildKillfeed({ map, kills: [], rezzes: [], roundEnds: [], durationSeconds: 0 });
    expect(kf.blocks).toEqual([]);
    expect(kf.header).toEqual({ matchTime: 0, kills: { ours: 0, theirs: 0 }, deaths: { ours: 0, theirs: 0 }, fightWins: { ours: 0, theirs: 0 } });
  });

  it("counts header stats ours-first, with suicides as deaths only", () => {
    const kills = [
      kill(10, "Team 1", "a", "Team 2", "b"),
      kill(12, "Team 1", "a", "Team 2", "c"),
      kill(14, "Team 2", "b", "Team 2", "b"),
      kill(100, "Team 2", "b", "Team 1", "a"),
    ];
    const kf = buildKillfeed({ map, kills, rezzes: [], roundEnds: [], durationSeconds: 300 });
    expect(kf.header).toEqual({ matchTime: 300, kills: { ours: 1, theirs: 2 }, deaths: { ours: 3, theirs: 1 }, fightWins: { ours: 1, theirs: 1 } });
  });

  it("tags kill kinds, methods, and criticals", () => {
    const kills = [
      kill(10, "Team 1", "a", "Team 2", "b", { eventAbility: "0", isCriticalHit: "True" }),
      kill(11, "Team 2", "b", "Team 2", "b"),
      kill(12, "Team 2", "c", "Team 2", "c", { isEnvironmental: "True" }),
    ];
    const kf = buildKillfeed({ map, kills, rezzes: [], roundEnds: [], durationSeconds: 60 });
    const block = kf.blocks[0];
    if (block.kind !== "fight") throw new Error("expected a fight block");
    expect(block.entries.map((e) => e.kind)).toEqual(["kill", "suicide", "environmental"]);
    const first = block.entries[0];
    if (first.kind === "rez") throw new Error("expected a kill entry");
    expect(first).toMatchObject({ method: UNKNOWN_METHOD, critical: true, attacker: { team: "Team 1", name: "a", hero: "Ana" }, victim: { team: "Team 2", name: "b", hero: "Genji" } });
  });

  it("places resurrections inside their fight, else in the next fight, else the last fight", () => {
    const kills = [kill(10, "Team 1", "a", "Team 2", "b"), kill(100, "Team 1", "a", "Team 2", "b"), kill(103, "Team 2", "b", "Team 1", "a")];
    const kf = buildKillfeed({ map, kills, rezzes: [rez(101, "x"), rez(50, "y"), rez(500, "z")], roundEnds: [], durationSeconds: 600 });
    const fights = kf.blocks.filter((b) => b.kind === "fight");
    const names = (i: number) => (fights[i].kind === "fight" ? fights[i].entries.filter((e) => e.kind === "rez").map((e) => (e.kind === "rez" ? e.resurrectee.name : "")) : []);
    expect(names(0)).toEqual([]);
    expect(names(1)).toEqual(["y", "x", "z"]);
  });

  it("puts a round block after the last fight ending at or before the round end, with a derived capturer", () => {
    const kills = [kill(10, "Team 1", "a", "Team 2", "b"), kill(200, "Team 1", "a", "Team 2", "b"), kill(400, "Team 2", "b", "Team 1", "a")];
    const roundEnds = [roundEnd(1, 200, 0, 1), roundEnd(2, 450, 1, 1), roundEnd(2, 450, 1, 1)];
    const kf = buildKillfeed({ map, kills, rezzes: [], roundEnds, durationSeconds: 450 });
    expect(kf.blocks.map((b) => (b.kind === "fight" ? `fight${b.fight.index}` : `round${b.roundNumber}:${b.capturingTeam}`))).toEqual([
      "fight1", "fight2", "round1:Team 2", "fight3", "round2:Team 1",
    ]);
  });

  it("matches the Busan sample", () => {
    const parsed = parseLog(readFileSync("test/samples/Log-2023-12-12-22-15-10.txt", "utf8"));
    const kills = parsed.events.kill as unknown as KillLike[];
    const roundEnds = parsed.events.round_end as unknown as Parameters<typeof buildKillfeed>[0]["roundEnds"];
    const kf = buildKillfeed({ map: { ...map, ourSide: 1 }, kills, rezzes: [], roundEnds, durationSeconds: 958.15 });
    expect(kf.header).toEqual({ matchTime: 958.15, kills: { ours: 52, theirs: 62 }, deaths: { ours: 62, theirs: 52 }, fightWins: { ours: 11, theirs: 11 } });
    expect(kf.blocks.filter((b) => b.kind === "fight")).toHaveLength(23);
    expect(kf.blocks.filter((b) => b.kind === "round")).toHaveLength(3);
  });
});
