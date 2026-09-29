import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildInitiation, INITIATION_LOOKBACK_SECONDS, type DamageLite } from "@/lib/stats/initiation";
import { groupFights, type KillLike } from "@/lib/stats/fights";
import { parseLog } from "@/lib/parser/parse";
import { deriveMapMeta } from "@/lib/parser/derive";
import { sides } from "@/lib/stats/sides";

const s = { ours: "A", theirs: "B" };
const kill = (matchTime: number, attackerTeam: string, victimTeam: string): KillLike => ({ matchTime, attackerTeam, attackerName: `${attackerTeam}p`, victimTeam, victimName: `${victimTeam}p` });
const dmg = (matchTime: number, attackerTeam: string, victimTeam: string, attackerName = `${attackerTeam}p`): DamageLite => ({ matchTime, attackerTeam, attackerName, attackerHero: "Ana", victimTeam });

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
    expect(r.summary.ours).toEqual({ initiated: 2, wonWhenInitiated: 1, fightsNotInitiated: 1, wonWhenNotInitiated: 0, initiationWinRate: 0.5, nonInitiationWinRate: null });
    expect(r.summary.theirs).toEqual({ initiated: 1, wonWhenInitiated: 0, fightsNotInitiated: 2, wonWhenNotInitiated: 1, initiationWinRate: null, nonInitiationWinRate: 0.5 });
  });

  it("shows an initiator on neither side without crediting either summary", () => {
    const fights = groupFights([kill(100, "A", "B")]);
    const r = buildInitiation(fights, [dmg(95, "C", "A")], s);
    expect(r.fights[0].initiator).toMatchObject({ side: null, team: "C", t: 95 });
    const empty = { initiated: 0, wonWhenInitiated: 0, fightsNotInitiated: 0, wonWhenNotInitiated: 0, initiationWinRate: null, nonInitiationWinRate: null };
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
