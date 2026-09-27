import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildReplay, ULT_PROXY_SECONDS, type ReplayRowsLike } from "@/lib/stats/replay";
import type { ReplayRows } from "@/lib/db/queries";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

// ReplayRows (database) must satisfy the pure input shape.
const _check: (r: ReplayRows) => ReplayRowsLike = (r) => r;
void _check;

const map = { mapName: "Busan", mapType: "Control", team1Name: "Team 1", team2Name: "Team 2", ourSide: 1, durationSeconds: 300 };
const s = { ours: "Team 1", theirs: "Team 2" };
const empty: ReplayRowsLike = {
  matchStarts: [], matchEnds: [], roundStarts: [], roundEnds: [], captures: [], swaps: [], ultStarts: [], ultEnds: [], kills: [],
  rezzes: [], damage: [], healing: [], ability1: [], ability2: [], ultCharged: [], heroSpawns: [], heroSwaps: [], objectiveUpdated: [], playerStats: [],
};
const ult = (matchTime: number, playerPosition: string | null = null) => ({ matchTime, playerTeam: "Team 1", playerName: "a", playerHero: "Mei", playerPosition });
const dmg = (matchTime: number, attackerPosition: string) => ({
  matchTime, attackerTeam: "Team 1", attackerName: "a", attackerHero: "Mei", victimTeam: "Team 2", victimName: "v", victimHero: "Ana", attackerPosition, victimPosition: null,
});
const kill = (matchTime: number, extra: Partial<ReplayRowsLike["kills"][number]> = {}) => ({
  matchTime, attackerTeam: "Team 1", attackerName: "a", attackerHero: "Mei", victimTeam: "Team 2", victimName: "v", victimHero: "Ana", eventAbility: "Primary Fire",
  attackerPosition: "(1, 0, 2)", victimPosition: "(3, 0, 4)", ...extra,
});

describe("buildReplay", () => {
  it("places an ult at the caster's nearest sample within the proxy window, else the end position, else nowhere", () => {
    expect(ULT_PROXY_SECONDS).toBe(3);
    const rows: ReplayRowsLike = { ...empty, ultStarts: [ult(10), ult(50), ult(90)], ultEnds: [ult(12, "(7, 0, 8)"), ult(52, "(9, 0, 9)"), ult(92)], damage: [dmg(8.4, "(5, 0, 6)"), dmg(11.5, "(5.5, 0, 6.5)"), dmg(46, "(0, 0, 0)")] };
    const r = buildReplay({ map, sides: s, rows, images: [] });
    expect(r.ults.map((u) => [u.start, u.end, u.x, u.z])).toEqual([[10, 12, 5.5, 6.5], [50, 52, 9, 9], [90, 92, null, null]]);
    expect(r.ultStates.map((u) => [u.t, u.state])).toEqual([[10, "used"], [50, "used"], [90, "used"]]);
  });

  it("carries kill and death positions, drops the attacker for suicides and environmental kills, and flags positions", () => {
    const rows: ReplayRowsLike = { ...empty, kills: [kill(5), kill(9, { attackerTeam: "Team 2", attackerName: "v", isEnvironmental: "True" })] };
    const r = buildReplay({ map, sides: s, rows, images: [] });
    expect(r.hasPositions).toBe(true);
    expect(r.kills[0]).toEqual({ t: 5, kind: "kill", attacker: { team: "Team 1", name: "a", hero: "Mei", x: 1, z: 2 }, victim: { team: "Team 2", name: "v", hero: "Ana", x: 3, z: 4 }, method: "Primary Fire" });
    expect(r.kills[1].kind).toBe("environmental");
    expect(r.kills[1].attacker).toBeNull();
    expect(r.deaths).toEqual([{ t: 5, team: "Team 2", name: "v", x: 3, z: 4 }, { t: 9, team: "Team 2", name: "v", x: 3, z: 4 }]);
    expect(r.players.map((p) => [p.name, p.side])).toEqual([["a", "ours"], ["v", "theirs"]]);
  });

  it("is a positionless timeline when no tuple parses", () => {
    const rows: ReplayRowsLike = { ...empty, kills: [kill(5, { attackerPosition: null, victimPosition: "2}" })], heroSpawns: [{ matchTime: 0, playerTeam: "Team 1", playerName: "a", playerHero: "Mei" }] };
    const r = buildReplay({ map, sides: s, rows, images: [] });
    expect(r.hasPositions).toBe(false);
    expect(r.stages).toHaveLength(1);
    expect(r.heroes).toEqual([{ team: "Team 1", name: "a", t: 0, hero: "Mei" }]);
    expect(r.feed.map((e) => e.kind)).toEqual(["fight", "kill"]);
  });

  it("attaches a calibrated image to the matching stage only", () => {
    const rows: ReplayRowsLike = { ...empty, roundStarts: [{ matchTime: 0, roundNumber: 1, objectiveIndex: 2 }, { matchTime: 100, roundNumber: 2, objectiveIndex: 0 }], roundEnds: [{ matchTime: 100, roundNumber: 1, capturingTeam: "", team1Score: 0, team2Score: 0 }] };
    const affine = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
    const r = buildReplay({ map, sides: s, rows, images: [{ stage: 0, id: 4, width: 800, height: 600, affine }] });
    expect(r.stages.map((st) => [st.stage, st.label, st.image?.id ?? null])).toEqual([[2, "Stage 2 · Round 1", null], [0, "Stage 0 · Round 2", 4]]);
  });

  it("reconciles with the Lijiang sample and stays under the size budget", () => {
    const parsed = parseLog(readFileSync("test/samples/Log-2026-04-02-17-21-48.txt", "utf8"));
    const meta = deriveMapMeta(parsed);
    const ev = parsed.events as unknown as Record<string, never[]>;
    const rows = {
      matchStarts: ev.match_start, matchEnds: ev.match_end, roundStarts: ev.round_start, roundEnds: ev.round_end, captures: ev.objective_captured ?? [], swaps: ev.hero_swap,
      ultStarts: ev.ultimate_start, ultEnds: ev.ultimate_end, kills: ev.kill, rezzes: [], damage: ev.damage, healing: ev.healing, ability1: ev.ability_1_used, ability2: ev.ability_2_used,
      ultCharged: ev.ultimate_charged, heroSpawns: ev.hero_spawn, heroSwaps: ev.hero_swap, objectiveUpdated: [], playerStats: ev.player_stat,
    } as unknown as ReplayRowsLike;
    const r = buildReplay({ map: { ...meta, ourSide: 1 }, sides: { ours: meta.team1Name, theirs: meta.team2Name }, rows, images: [] });
    expect(r.hasPositions).toBe(true);
    expect(r.durationSeconds).toBe(744.21);
    expect(r.stages.map((st) => st.stage)).toEqual([2, 0, 1]);
    expect(r.players).toHaveLength(10);
    expect(r.kills).toHaveLength(80);
    expect(r.ults.length).toBeGreaterThan(25);
    expect(r.ults.length).toBeLessThanOrEqual(33);
    expect(r.ults.filter((u) => u.x !== null).length).toBeGreaterThan(20);
    expect(r.heroes).toHaveLength(28);
    expect(JSON.stringify(r).length).toBeLessThan(300_000);
  });
});
