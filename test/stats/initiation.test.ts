import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildInitiation, buildTeamInitiation, INITIATION_LOOKBACK_SECONDS, type DamageLite } from "@/lib/stats/initiation";
import { fightsByMap, groupFights, type KillLike } from "@/lib/stats/fights";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";
import { sides } from "@/lib/stats/sides";
import type { TeamMapLike } from "@/lib/stats/team-rows";

const s = { ours: "A", theirs: "B" };
const kill = (matchTime: number, attackerTeam: string, victimTeam: string): KillLike => ({ matchTime, attackerTeam, attackerName: `${attackerTeam}p`, victimTeam, victimName: `${victimTeam}p` });
const dmg = (matchTime: number, attackerTeam: string, victimTeam: string, attackerName = `${attackerTeam}p`): DamageLite => ({ matchTime, attackerTeam, attackerName, attackerHero: "Ana", victimTeam });
const teamMap = (id: number): TeamMapLike => ({ id, scrimId: id, scrimName: `vs ${id}`, scrimDate: "2026-09-10", mapName: "Busan", mapType: "Control", team1Name: "A", team2Name: "B", ourSide: 1, winnerSide: 1, durationSeconds: 600 });
const tk = (mapId: number, matchTime: number, attackerTeam: string, victimTeam: string) => ({ ...kill(matchTime, attackerTeam, victimTeam), mapId });
const td = (mapId: number, matchTime: number, attackerTeam: string, victimTeam: string) => ({ ...dmg(matchTime, attackerTeam, victimTeam), mapId });

describe("buildInitiation", () => {
  it("picks the earliest cross-team damage within the lookback before the first kill", () => {
    const fights = groupFights([kill(100, "A", "B"), kill(105, "A", "B")]);
    const damage = [dmg(85, "B", "A"), dmg(91, "B", "A", "early"), dmg(92, "A", "B"), dmg(101, "A", "B")];
    const r = buildInitiation(fights, damage, s);
    expect(r.fights[0]).toMatchObject({ index: 1, initiator: { side: "theirs", team: "B", name: "early", hero: "Ana", t: 91 }, secondsToFirstKill: 9, firstKillSide: "ours", winner: "ours" });
    expect(INITIATION_LOOKBACK_SECONDS).toBe(10);
  });

  it("never counts same-team damage and leaves a fight without a candidate at null", () => {
    const fights = groupFights([kill(100, "A", "B")]);
    const r = buildInitiation(fights, [dmg(95, "A", "A"), dmg(120, "A", "B")], s);
    expect(r.fights[0].initiator).toBeNull();
    expect(r.fights[0].secondsToFirstKill).toBeNull();
    expect(r.hasDamage).toBe(true);
  });

  it("does not let a row inside the previous fight initiate the next one", () => {
    // A 6 s fight gap makes two fights whose lookback windows overlap: [100, 104] and [112].
    const fights = groupFights([kill(100, "A", "B"), kill(104, "A", "B"), kill(112, "A", "B")], 6);
    const damage = [dmg(103, "B", "A"), dmg(107, "A", "B")];
    const r = buildInitiation(fights, damage, s);
    expect(fights).toHaveLength(2);
    expect(r.fights[1].initiator).toMatchObject({ team: "A", t: 107 });
    expect(r.fights[1].secondsToFirstKill).toBe(5);
  });

  it("summarises per side over decided fights only", () => {
    const fights = groupFights([
      kill(100, "A", "B"), kill(101, "A", "B"),
      kill(200, "B", "A"), kill(201, "B", "A"),
      kill(300, "A", "B"), kill(301, "B", "A"),
      kill(400, "B", "A"),
    ]);
    const damage = [dmg(95, "A", "B"), dmg(195, "A", "B"), dmg(295, "B", "A")];
    const r = buildInitiation(fights, damage, s);
    expect(r.summary.ours).toEqual({ initiated: 2, wonWhenInitiated: 1, decidedInitiated: 2, fightsNotInitiated: 1, wonWhenNotInitiated: 0, decidedNotInitiated: 0, initiationWinRate: 0.5, nonInitiationWinRate: null });
    expect(r.summary.theirs).toEqual({ initiated: 1, wonWhenInitiated: 0, decidedInitiated: 0, fightsNotInitiated: 2, wonWhenNotInitiated: 1, decidedNotInitiated: 2, initiationWinRate: null, nonInitiationWinRate: 0.5 });
  });

  it("shows an initiator on neither side without crediting either summary", () => {
    const fights = groupFights([kill(100, "A", "B")]);
    const r = buildInitiation(fights, [dmg(95, "C", "A")], s);
    expect(r.fights[0].initiator).toMatchObject({ side: null, team: "C", t: 95 });
    const empty = { initiated: 0, wonWhenInitiated: 0, decidedInitiated: 0, fightsNotInitiated: 0, wonWhenNotInitiated: 0, decidedNotInitiated: 0, initiationWinRate: null, nonInitiationWinRate: null };
    expect(r.summary.ours).toEqual(empty);
    expect(r.summary.theirs).toEqual(empty);
  });

  it("leaves firstKillSide null when a fight has no counted kill", () => {
    const fights = groupFights([{ ...kill(100, "A", "A"), attackerName: "Ap", victimName: "Ap" }]);
    const r = buildInitiation(fights, [], s);
    expect(r.fights[0].firstKillSide).toBeNull();
    expect(r.fights[0].winner).toBeNull();
  });

  it("reports hasDamage false and all-null initiators with no damage rows", () => {
    const r = buildInitiation(groupFights([kill(1, "A", "B")]), [], s);
    expect(r.hasDamage).toBe(false);
    expect(r.fights.map((f) => f.initiator)).toEqual([null]);
    expect(r.summary.ours.initiationWinRate).toBeNull();
  });

  it("works on the Aatlis sample, which has damage rows but no positions", () => {
    const parsed = parseLog(readFileSync("test/samples/Log-2026-09-18-13-52-18.txt", "utf8"));
    const meta = deriveMapMeta(parsed);
    const sd = sides({ ...meta, ourSide: 1 });
    const fights = groupFights((parsed.events.kill ?? []) as unknown as KillLike[]);
    const r = buildInitiation(fights, (parsed.events.damage ?? []) as unknown as DamageLite[], sd);
    expect(fights).toHaveLength(13);
    expect(r.hasDamage).toBe(true);
    const withInitiator = r.fights.filter((f) => f.initiator !== null);
    expect(withInitiator.length).toBe(r.summary.ours.initiated + r.summary.theirs.initiated);
    for (const f of withInitiator) expect(f.secondsToFirstKill).toBeGreaterThanOrEqual(0);
    expect([r.summary.ours.initiated, r.summary.theirs.initiated]).toMatchInlineSnapshot(`
      [
        9,
        4,
      ]
    `);
  });
});

describe("buildTeamInitiation", () => {
  it("sums the per-map counters and recomputes rates from the sums", () => {
    // Map 1: A engages and wins 2 fights. Map 2: A engages and loses 1, B engages and A wins 1.
    const kills = [tk(1, 100, "A", "B"), tk(1, 200, "A", "B"), tk(2, 100, "B", "A"), tk(2, 200, "A", "B")];
    const damage = [td(1, 95, "A", "B"), td(1, 195, "A", "B"), td(2, 95, "A", "B"), td(2, 195, "B", "A")];
    const t = buildTeamInitiation([teamMap(1), teamMap(2)], fightsByMap(kills), damage);
    expect(t).toMatchObject({ maps: 2, mapsWithDamage: 2 });
    expect(t.summary.ours).toEqual({ initiated: 3, wonWhenInitiated: 2, decidedInitiated: 3, fightsNotInitiated: 1, wonWhenNotInitiated: 1, decidedNotInitiated: 1, initiationWinRate: 2 / 3, nonInitiationWinRate: 1 });
    expect(t.summary.theirs.initiationWinRate).toBe(0);
  });

  it("counts a map without damage rows toward maps only", () => {
    const t = buildTeamInitiation([teamMap(1), teamMap(2)], fightsByMap([tk(1, 100, "A", "B"), tk(2, 100, "A", "B")]), [td(1, 95, "A", "B")]);
    expect(t).toMatchObject({ maps: 2, mapsWithDamage: 1 });
    expect(t.summary.ours.initiated).toBe(1);
  });

  it("returns nulls with no damage at all", () => {
    const t = buildTeamInitiation([teamMap(1)], fightsByMap([tk(1, 100, "A", "B")]), []);
    expect(t.mapsWithDamage).toBe(0);
    expect(t.summary.ours.initiationWinRate).toBeNull();
  });
});
