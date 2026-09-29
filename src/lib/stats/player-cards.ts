import { killKind, type KillLike } from "./fights";
import { ROLE_ORDER, roleOf, type Role } from "./heroes";
import { per10, type PlayerStatLike } from "./overview";
import { dedupeRounds } from "./rounds";
import { sides } from "./sides";
import { finalsByMap, groupByMap, ourRowsByMap, type MapKeyed, type StatLike, type TeamMapLike } from "./team-rows";

/** MVP score, deadlift share, and play style need this many maps in range. */
export const MIN_PROFILE_MAPS = 3;
/**
 * A map counts toward the MVP score and play style only when the player has this much hero time on it
 * (on the filtered hero under a hero filter), so a short stint's per-10 numbers cannot inflate them.
 * Same floor as the best-performance card. Deadlift, drought, and records use every map played.
 */
export const MIN_PROFILE_SECONDS = 180;
/** A play-style ratio within ±PLAYSTYLE_BAND of 1 is "even". */
export const PLAYSTYLE_BAND = 0.1;

export type MvpKey = "eliminations" | "finalBlows" | "deaths" | "heroDamageDealt" | "healingDealt" | "damageBlocked";
const MVP_KEYS: MvpKey[] = ["eliminations", "finalBlows", "deaths", "heroDamageDealt", "healingDealt", "damageBlocked"];

export interface MvpStat {
  key: MvpKey;
  weight: number;
  /** Lower is better: the ratio is reference / player. */
  invert?: boolean;
}

/** Per-role MVP stats, each compared per 10 minutes to our players of the same role. */
export const MVP_STATS: Record<Role, MvpStat[]> = {
  Tank: [{ key: "eliminations", weight: 1 }, { key: "heroDamageDealt", weight: 1 }, { key: "damageBlocked", weight: 1 }, { key: "deaths", weight: 1, invert: true }],
  Damage: [{ key: "finalBlows", weight: 1 }, { key: "eliminations", weight: 1 }, { key: "heroDamageDealt", weight: 1 }, { key: "deaths", weight: 1, invert: true }],
  Support: [{ key: "healingDealt", weight: 1 }, { key: "eliminations", weight: 1 }, { key: "heroDamageDealt", weight: 1 }, { key: "deaths", weight: 1, invert: true }],
  Unknown: [{ key: "eliminations", weight: 1 }, { key: "heroDamageDealt", weight: 1 }, { key: "deaths", weight: 1, invert: true }],
};

export type Per10 = Record<MvpKey, number>;
export type RoleReference = Record<Role, Per10>;

export interface MapRef {
  mapId: number;
  scrimId: number;
  mapName: string;
  scrimDate: string;
}

export interface MvpScore {
  /** Mean map score over the rated maps; null below MIN_PROFILE_MAPS rated maps. */
  score: number | null;
  /** Maps with at least MIN_PROFILE_SECONDS of hero time. */
  maps: number;
  /** Maps where the player's score was at least every teammate's. */
  mvpCount: number;
}

export interface Deadlift {
  meanShare: number;
  best: MapRef & { share: number };
}

export interface Drought {
  longestSeconds: number;
  longestMap: MapRef;
  meanSeconds: number;
}

export type RecordKey = "finalBlows" | "eliminations" | "heroDamage" | "healing" | "damageBlocked" | "multikillBest" | "soloKills" | "objectiveKills" | "longestLife";

export interface PersonalRecord extends MapRef {
  key: RecordKey;
  label: string;
  value: number;
}

export type Band = "high" | "even" | "low";

export interface PlayStyle {
  /** (final blows + eliminations) per 10 over the role reference. */
  aggression: number;
  /** Reference deaths per 10 over the player's. */
  survival: number;
  /** Healing per 10 for Support, hero damage per 10 otherwise, over the reference. */
  output: number;
  bands: { aggression: Band; survival: Band; output: Band };
  sentence: string;
}

export interface ProfileCards {
  mvp: MvpScore;
  deadlift: Deadlift | null;
  drought: Drought | null;
  records: PersonalRecord[];
  playStyle: PlayStyle | null;
}

export interface RoundRowLike extends MapKeyed {
  matchTime: number;
  roundNumber: number;
}

/** The row lists the profile cards need; a PlayerRows (and so a TeamRows) value satisfies it. */
export interface ProfileRows {
  playerStats: StatLike[];
  kills: (KillLike & MapKeyed)[];
  roundStarts: RoundRowLike[];
}

const sum = (rows: PlayerStatLike[], key: MvpKey | "heroTimePlayed" | "multikillBest" | "soloKills" | "objectiveKills") => rows.reduce((n, r) => n + r[key], 0);
const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

/** Each MVP stat per 10 minutes of the rows' combined hero time. */
export function per10Of(rows: PlayerStatLike[]): Per10 {
  const t = sum(rows, "heroTimePlayed");
  return Object.fromEntries(MVP_KEYS.map((k) => [k, per10(sum(rows, k), t)])) as Per10;
}

/** Our side's per-10 by role over every map in range: sums over rows, then per 10 of the summed time (time-weighted). */
export function roleReference(maps: TeamMapLike[], playerStats: StatLike[]): RoleReference {
  const finals = finalsByMap(playerStats);
  const byRole = new Map<Role, StatLike[]>();
  for (const m of maps) {
    const ours = sides(m).ours;
    for (const r of finals.get(m.id) ?? []) {
      if (r.playerTeam !== ours || r.heroTimePlayed <= 0) continue;
      const role = roleOf(r.playerHero);
      byRole.set(role, [...(byRole.get(role) ?? []), r]);
    }
  }
  return Object.fromEntries(ROLE_ORDER.map((role) => [role, per10Of(byRole.get(role) ?? [])])) as RoleReference;
}

/** player / reference; reference / player when inverted. A zero reference, or a zero player value when inverted, is par (1). */
export function ratioOf(player: number, reference: number, invert = false): number {
  if (reference === 0) return 1;
  if (invert) return player === 0 ? 1 : reference / player;
  return player / reference;
}

/** Weighted mean of the role's stat ratios, times 100. */
export function mvpMapScore(rows: PlayerStatLike[], role: Role, ref: RoleReference): number {
  const p = per10Of(rows);
  const stats = MVP_STATS[role];
  const weight = stats.reduce((n, s) => n + s.weight, 0);
  return (stats.reduce((n, s) => n + s.weight * ratioOf(p[s.key], ref[role][s.key], s.invert), 0) / weight) * 100;
}

/** The role with the most hero time in `rows`; ties go to the earlier role in ROLE_ORDER. */
export function mainRole(rows: PlayerStatLike[]): Role {
  const t = new Map<Role, number>();
  for (const r of rows) t.set(roleOf(r.playerHero), (t.get(roleOf(r.playerHero)) ?? 0) + r.heroTimePlayed);
  return ROLE_ORDER.reduce((best, role) => ((t.get(role) ?? 0) > (t.get(best) ?? 0) ? role : best), ROLE_ORDER[0]);
}

export function band(v: number): Band {
  if (v > 1 + PLAYSTYLE_BAND) return "high";
  if (v < 1 - PLAYSTYLE_BAND) return "low";
  return "even";
}

const WORDS: Record<keyof PlayStyle["bands"], Record<Band, string>> = {
  aggression: { high: "Aggressive", even: "Balanced", low: "Passive" },
  survival: { high: "durable", even: "average survival", low: "fragile" },
  output: { high: "high output", even: "even output", low: "low output" },
};

const RECORDS: Array<{ key: Exclude<RecordKey, "longestLife">; label: string; of: (rows: StatLike[]) => number }> = [
  { key: "finalBlows", label: "Final blows", of: (r) => sum(r, "finalBlows") },
  { key: "eliminations", label: "Eliminations", of: (r) => sum(r, "eliminations") },
  { key: "heroDamage", label: "Hero damage", of: (r) => sum(r, "heroDamageDealt") },
  { key: "healing", label: "Healing", of: (r) => sum(r, "healingDealt") },
  { key: "damageBlocked", label: "Damage blocked", of: (r) => sum(r, "damageBlocked") },
  { key: "multikillBest", label: "Best multikill", of: (r) => Math.max(0, ...r.map((x) => x.multikillBest)) },
  { key: "soloKills", label: "Solo kills", of: (r) => sum(r, "soloKills") },
  { key: "objectiveKills", label: "Objective kills", of: (r) => sum(r, "objectiveKills") },
];

/**
 * Gaps between consecutive times. Under "all heroes" the first gap is measured from `open` (clamped to
 * 0, so an event logged before the round start can't drag the mean); under a hero filter we don't know
 * when the player swapped to that hero, so the opening gap is dropped and only gaps between the
 * player's own events on that hero are counted.
 */
const gaps = (times: number[], open: number, includeOpen: boolean): number[] => {
  const all = times.map((t, i) => (i === 0 ? Math.max(0, t - open) : t - times[i - 1]));
  return includeOpen ? all : all.slice(1);
};

export function buildProfileCards(maps: TeamMapLike[], rows: ProfileRows, name: string, filter: string | null): ProfileCards {
  const byMap = ourRowsByMap(maps, rows.playerStats, name, filter);
  const playerMaps = maps.filter((m) => byMap.has(m.id));
  const timeOn = (m: TeamMapLike) => sum(byMap.get(m.id) ?? [], "heroTimePlayed");
  const ratedMaps = playerMaps.filter((m) => timeOn(m) >= MIN_PROFILE_SECONDS);
  const ratedRows = ratedMaps.flatMap((m) => byMap.get(m.id) ?? []);
  const ref = roleReference(maps, rows.playerStats);
  const finals = finalsByMap(rows.playerStats);
  const killsBy = groupByMap(rows.kills);
  const roundsBy = groupByMap(rows.roundStarts);
  const role = filter === null ? mainRole(ratedRows) : roleOf(filter);
  const enough = playerMaps.length >= MIN_PROFILE_MAPS;
  const enoughRated = ratedMaps.length >= MIN_PROFILE_MAPS;
  const mapRef = (m: TeamMapLike): MapRef => ({ mapId: m.id, scrimId: m.scrimId, mapName: m.mapName, scrimDate: m.scrimDate });
  const openOf = (m: TeamMapLike) => dedupeRounds(roundsBy.get(m.id) ?? [])[0]?.matchTime ?? 0;
  const blows = (m: TeamMapLike) => {
    const ours = sides(m).ours;
    return (killsBy.get(m.id) ?? [])
      .filter((k) => k.attackerTeam === ours && k.attackerName === name && (filter === null || k.attackerHero === filter) && killKind(k) === "kill")
      .map((k) => k.matchTime).sort((a, b) => a - b);
  };
  const deaths = (m: TeamMapLike) => {
    const ours = sides(m).ours;
    return (killsBy.get(m.id) ?? []).filter((k) => k.victimTeam === ours && k.victimName === name && (filter === null || k.victimHero === filter)).map((k) => k.matchTime).sort((a, b) => a - b);
  };

  // MVP score over the rated maps: the player's map score against every teammate's, both scored on their own main role for that map.
  const scores: number[] = [];
  let mvpCount = 0;
  for (const m of ratedMaps) {
    const ours = sides(m).ours;
    const mapRole = filter === null ? mainRole(byMap.get(m.id) ?? []) : roleOf(filter);
    const mine = mvpMapScore(byMap.get(m.id) ?? [], mapRole, ref);
    scores.push(mine);
    const teammates = new Map<string, StatLike[]>();
    for (const r of finals.get(m.id) ?? []) {
      if (r.playerTeam !== ours || r.playerName === name || r.heroTimePlayed <= 0) continue;
      teammates.set(r.playerName, [...(teammates.get(r.playerName) ?? []), r]);
    }
    const best = Math.max(0, ...[...teammates.values()].map((t) => mvpMapScore(t, mainRole(t), ref)));
    if (mine >= best) mvpCount += 1;
  }
  const mvp: MvpScore = { score: enoughRated ? mean(scores) : null, maps: ratedMaps.length, mvpCount };

  // Deadlift: share of our side's hero damage per map.
  const shares: Array<{ share: number; map: TeamMapLike }> = [];
  for (const m of playerMaps) {
    const ours = sides(m).ours;
    const team = sum((finals.get(m.id) ?? []).filter((r) => r.playerTeam === ours), "heroDamageDealt");
    if (team <= 0) continue;
    shares.push({ share: sum(byMap.get(m.id) ?? [], "heroDamageDealt") / team, map: m });
  }
  const bestShare = shares.reduce<{ share: number; map: TeamMapLike } | null>((b, s) => (b === null || s.share > b.share ? s : b), null);
  const deadlift: Deadlift | null = enough && bestShare ? { meanShare: mean(shares.map((s) => s.share)) ?? 0, best: { ...mapRef(bestShare.map), share: bestShare.share } } : null;

  // Drought: gaps between the player's counted final blows, the first from the round start under "all heroes" only; no tail.
  let drought: Drought | null = null;
  const allGaps: number[] = [];
  for (const m of playerMaps) {
    const g = gaps(blows(m), openOf(m), filter === null);
    if (g.length === 0) continue;
    allGaps.push(...g);
    const longest = Math.max(...g);
    if (!drought || longest > drought.longestSeconds) drought = { longestSeconds: longest, longestMap: mapRef(m), meanSeconds: 0 };
  }
  if (drought) drought.meanSeconds = mean(allGaps) ?? 0;

  // Personal records: the best map per stat, first map on a tie, omitted when zero everywhere.
  const records: PersonalRecord[] = [];
  for (const rec of RECORDS) {
    let best: PersonalRecord | null = null;
    for (const m of playerMaps) {
      const value = rec.of(byMap.get(m.id) ?? []);
      if (value > (best?.value ?? 0)) best = { ...mapRef(m), key: rec.key, label: rec.label, value };
    }
    if (best) records.push(best);
  }
  // Longest life: gaps between the player's deaths, the first from the round start under "all heroes" only.
  let life: PersonalRecord | null = null;
  for (const m of playerMaps) {
    const g = gaps(deaths(m), openOf(m), filter === null);
    const longest = g.length === 0 ? 0 : Math.max(...g);
    if (longest > (life?.value ?? 0)) life = { ...mapRef(m), key: "longestLife", label: "Longest life", value: longest };
  }
  if (life) records.push(life);

  // Play style: three ratios to the role reference over the rated maps.
  const p = per10Of(ratedRows);
  const r = ref[role];
  const outputKey: MvpKey = role === "Support" ? "healingDealt" : "heroDamageDealt";
  const aggression = ratioOf(p.finalBlows + p.eliminations, r.finalBlows + r.eliminations);
  const survival = ratioOf(p.deaths, r.deaths, true);
  const output = ratioOf(p[outputKey], r[outputKey]);
  const bands = { aggression: band(aggression), survival: band(survival), output: band(output) };
  const playStyle: PlayStyle | null = enoughRated
    ? { aggression, survival, output, bands, sentence: `${WORDS.aggression[bands.aggression]}, ${WORDS.survival[bands.survival]}, ${WORDS.output[bands.output]}` }
    : null;

  return { mvp, deadlift, drought, records, playStyle };
}
