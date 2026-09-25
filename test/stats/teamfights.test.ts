import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildTeamfights } from "@/lib/stats/teamfights";
import type { KillLike } from "@/lib/stats/fights";
import type { MapKeyed, TeamMapLike } from "@/lib/stats/team-rows";
import type { UltLike } from "@/lib/stats/ultimates";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";

const map: TeamMapLike = { id: 1, scrimId: 1, scrimName: "vs X", scrimDate: "2026-09-10", mapName: "Busan", mapType: "Control", team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600 };
type Kill = KillLike & MapKeyed;
type Ult = UltLike & MapKeyed;
/** A kills B by default. */
const kill = (matchTime: number, attackerTeam = "A", victimTeam = "B", extra: Partial<Kill> = {}): Kill => ({
  mapId: 1, matchTime, attackerTeam, attackerName: `${attackerTeam}p`, victimTeam, victimName: `${victimTeam}p`, ...extra,
});
const suicide = (matchTime: number, team: string): Kill => kill(matchTime, team, team, { attackerName: `${team}p`, victimName: `${team}p` });
const ult = (matchTime: number, playerTeam: string, mapId = 1): Ult => ({ mapId, matchTime, playerTeam, playerName: `${playerTeam}u`, playerHero: "Ana" });

describe("buildTeamfights", () => {
  it("returns zeros and nulls for no maps", () => {
    const t = buildTeamfights([], [], [], []);
    expect(t.ours).toEqual({
      fights: 0, won: 0, lost: 0, drawn: 0, winRate: null,
      firstPick: { count: 0, won: 0, rate: null }, firstDeath: { count: 0, won: 0, rate: null }, firstUlt: { count: 0, won: 0, rate: null },
      reversals: 0, dry: { count: 0, won: 0, rate: null, winRate: null }, ultsUsed: 0, ultsPerFight: null, ultEfficiency: null, wastedUlts: 0,
    });
    expect(t.byScrim).toEqual([]);
  });

  it("takes first pick from the first counted kill and first death from any kill", () => {
    // Fight 1: B suicides at 1, then A kills twice. Won by A; first death B; first pick A.
    const t = buildTeamfights([map], [suicide(1, "B"), kill(2), kill(3)], [], []);
    expect(t.ours).toMatchObject({ fights: 1, won: 1, firstPick: { count: 1, won: 1, rate: 1 }, firstDeath: { count: 0 }, reversals: 0 });
    expect(t.theirs).toMatchObject({ fights: 1, lost: 1, firstPick: { count: 0 }, firstDeath: { count: 1, won: 0, rate: 0 } });
  });

  it("attributes an ult before the first kill to that fight, counts dry fights, and wastes ults in lost fights", () => {
    const t = buildTeamfights([map], [kill(10), kill(11)], [ult(5, "B")], []);
    expect(t.theirs).toMatchObject({ firstUlt: { count: 1, won: 0, rate: 0 }, dry: { count: 0, won: 0, rate: 0, winRate: null }, ultsUsed: 1, ultsPerFight: 1, ultEfficiency: 0, wastedUlts: 1 });
    expect(t.ours).toMatchObject({ firstUlt: { count: 0 }, dry: { count: 1, won: 1, rate: 1, winRate: 1 }, ultsUsed: 0, ultsPerFight: 0, ultEfficiency: null, wastedUlts: 0 });
  });

  it("wastes an ult cast after the last fight and in a drawn fight", () => {
    // Fight 1 at 10–11 is a draw (one kill each); our ult at 100 has no fight.
    const t = buildTeamfights([map], [kill(10), kill(11, "B", "A")], [ult(10.5, "A"), ult(100, "A")], []);
    expect(t.ours).toMatchObject({ fights: 1, drawn: 1, winRate: null, ultsUsed: 2, wastedUlts: 2, ultEfficiency: 0 });
    expect(t.byScrim).toEqual([{ scrimId: 1, name: "vs X", date: "2026-09-10", fights: 1, won: 0, lost: 0, drawn: 1, winRate: null }]);
  });

  it("counts a reversal when we die first and win", () => {
    const t = buildTeamfights([map], [kill(10, "B", "A"), kill(12), kill(13)], [], []);
    expect(t.ours).toMatchObject({ won: 1, firstDeath: { count: 1, won: 1, rate: 1 }, reversals: 1 });
  });

  it("keeps maps apart and frames each by its own side", () => {
    const second: TeamMapLike = { ...map, id: 2, ourSide: 2, scrimId: 2, scrimName: "vs Y", scrimDate: "2026-09-12" };
    const kills = [kill(10), kill(11), { ...kill(10), mapId: 2 }, { ...kill(11), mapId: 2 }];
    const t = buildTeamfights([map, second], kills, [ult(50, "A"), ult(50, "A", 2)], []);
    expect(t.ours).toMatchObject({ fights: 2, won: 1, lost: 1, winRate: 0.5, ultsUsed: 1 });
    expect(t.theirs).toMatchObject({ fights: 2, won: 1, lost: 1, ultsUsed: 1 });
    expect(t.byScrim.map((s) => [s.scrimId, s.won, s.lost])).toEqual([[1, 1, 0], [2, 0, 1]]);
  });

  it("reconciles with the Aatlis and Busan samples", () => {
    const load = (name: string, id: number, ourSide: number): { map: TeamMapLike; kills: Kill[]; starts: Ult[]; ends: Ult[] } => {
      const parsed = parseLog(readFileSync(`test/samples/${name}.txt`, "utf8"));
      const meta = deriveMapMeta(parsed);
      const tag = <T>(rows: T[] | undefined) => (rows ?? []).map((r) => ({ ...r, mapId: id })) as unknown as never[];
      return { map: { id, scrimId: id, scrimName: name, scrimDate: "2026-09-18", ...meta, ourSide }, kills: tag(parsed.events.kill), starts: tag(parsed.events.ultimate_start), ends: tag(parsed.events.ultimate_end) };
    };
    const a = load("Log-2026-09-18-13-52-18", 1, 1);
    const t = buildTeamfights([a.map], a.kills, a.starts, a.ends);
    expect(t.ours).toMatchObject({ fights: 13, won: 1, lost: 12, drawn: 0, firstPick: { count: 2 } });
    expect(t.theirs).toMatchObject({ firstPick: { count: 11 } });
    expect(t.ours.ultsUsed + t.theirs.ultsUsed).toBe(25);
    const b = load("Log-2023-12-12-22-15-10", 2, 1);
    const u = buildTeamfights([b.map], b.kills, b.starts, b.ends);
    expect(u.ours).toMatchObject({ fights: 23, won: 11, lost: 11, drawn: 1, winRate: 0.5 });
    expect(u.ours.ultsUsed + u.theirs.ultsUsed).toBe(51);
    expect(u.ours.wastedUlts + u.theirs.wastedUlts).toBeGreaterThanOrEqual(1);
  });
});
