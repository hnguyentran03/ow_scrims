import { fightIndexAt, groupFights, type KillLike } from "./fights";
import { abilityName } from "./heroes";
import { sideOf, sides, type SideKey } from "./sides";
import { finalsByMap, groupByMap, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";
import { bucket, heroesPlayed, liftOf, tally, toRatio, type Bucket, type ImpactRatio } from "./ult-impact";

/** A won or lost bucket needs this many decided fights before its uses-per-fight mean (or a lift) is shown. */
export const MIN_ABILITY_FIGHTS = 5;

export interface AbilityLike {
  matchTime: number;
  playerTeam: string;
  playerName: string;
  playerHero: string;
  slot: 1 | 2;
}

export interface AbilityImpactRow {
  hero: string;
  slot: 1 | 2;
  ability: string;
  /** Every use by this side, in a fight or not. */
  uses: number;
  /** Mean uses per decided fight this side won / lost, on maps where the side played the hero; null under the guard. */
  perFightWon: number | null;
  perFightLost: number | null;
  with: ImpactRatio;
  without: ImpactRatio;
  lift: number | null;
}

export interface AbilityImpact {
  ours: AbilityImpactRow[];
  theirs: AbilityImpactRow[];
  hasAbilities: boolean;
}

interface Acc {
  hero: string;
  slot: 1 | 2;
  uses: number;
  with: Bucket;
  without: Bucket;
  wonFights: number;
  wonUses: number;
  lostFights: number;
  lostUses: number;
}

const newAcc = (hero: string, slot: 1 | 2): Acc => ({ hero, slot, uses: 0, with: bucket(), without: bucket(), wonFights: 0, wonUses: 0, lostFights: 0, lostUses: 0 });
const SIDES: SideKey[] = ["ours", "theirs"];
const key = (hero: string, slot: 1 | 2) => `${hero}|${slot}`;

export function buildAbilityImpact(maps: TeamMapLike[], kills: (KillLike & MapKeyed)[], abilities: (AbilityLike & MapKeyed)[], playerStats: StatLike[]): AbilityImpact {
  const killsBy = groupByMap(kills);
  const abilitiesBy = groupByMap(abilities);
  const finals = finalsByMap(playerStats);
  const acc: Record<SideKey, Map<string, Acc>> = { ours: new Map(), theirs: new Map() };

  for (const map of maps) {
    const s = sides(map);
    const fights = groupFights(killsBy.get(map.id) ?? []);
    const rows = (abilitiesBy.get(map.id) ?? []).map((r) => ({ ...r, side: sideOf(r.playerTeam, s), fightIndex: fightIndexAt(r.matchTime, fights) }));
    const mapFinals = finals.get(map.id) ?? [];

    for (const side of SIDES) {
      const played = heroesPlayed(mapFinals, s[side]);
      const sideRows = rows.filter((r) => r.side === side);
      const byKey = new Map<string, typeof sideRows>();
      for (const r of sideRows) {
        const k = key(r.playerHero, r.slot);
        byKey.set(k, [...(byKey.get(k) ?? []), r]);
      }
      for (const [k, uses] of byKey) {
        const a = acc[side].get(k) ?? newAcc(uses[0].playerHero, uses[0].slot);
        a.uses += uses.length;
        const perFight = new Map<number, number>();
        for (const u of uses) if (u.fightIndex !== null) perFight.set(u.fightIndex, (perFight.get(u.fightIndex) ?? 0) + 1);
        for (const f of fights) {
          const n = perFight.get(f.index) ?? 0;
          if (n === 0 && !played.has(a.hero)) continue;
          tally(n > 0 ? a.with : a.without, f, side, s);
          if (f.winner === null) continue;
          if (sideOf(f.winner, s) === side) { a.wonFights += 1; a.wonUses += n; }
          else { a.lostFights += 1; a.lostUses += n; }
        }
        acc[side].set(k, a);
      }
    }
  }

  const rows = (m: Map<string, Acc>): AbilityImpactRow[] =>
    [...m.values()]
      .map((a) => ({
        hero: a.hero, slot: a.slot, ability: abilityName(a.hero, a.slot), uses: a.uses,
        perFightWon: a.wonFights >= MIN_ABILITY_FIGHTS ? a.wonUses / a.wonFights : null,
        perFightLost: a.lostFights >= MIN_ABILITY_FIGHTS ? a.lostUses / a.lostFights : null,
        with: toRatio(a.with), without: toRatio(a.without), lift: liftOf(a.with, a.without, MIN_ABILITY_FIGHTS),
      }))
      .sort((x, y) => y.uses - x.uses || x.hero.localeCompare(y.hero) || x.slot - y.slot);
  return { ours: rows(acc.ours), theirs: rows(acc.theirs), hasAbilities: abilities.length > 0 };
}
