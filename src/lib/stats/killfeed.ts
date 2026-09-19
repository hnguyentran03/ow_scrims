import { groupFights, isFlagSet, killKind, type Fight, type KillKind, type KillLike } from "./fights";
import { dedupeRounds, roundCapturer, type RoundEndLike } from "./rounds";
import { sides } from "./sides";

export interface MapLike {
  team1Name: string;
  team2Name: string;
  ourSide: number;
}

export interface RezLike {
  matchTime: number;
  resurrecterTeam: string;
  resurrecterPlayer: string;
  resurrecterHero: string;
  resurrecteeTeam: string;
  resurrecteePlayer: string;
  resurrecteeHero: string;
}

export interface Actor {
  team: string;
  name: string;
  hero: string;
}

export interface KillEntry {
  kind: KillKind;
  time: number;
  attacker: Actor;
  victim: Actor;
  method: string;
  critical: boolean;
}

export interface RezEntry {
  kind: "rez";
  time: number;
  resurrecter: Actor;
  resurrectee: Actor;
}

export type KillfeedEntry = KillEntry | RezEntry;

export type KillfeedBlock =
  | { kind: "fight"; fight: Fight; entries: KillfeedEntry[] }
  | { kind: "round"; roundNumber: number; capturingTeam: string | null };

export interface TeamPair {
  ours: number;
  theirs: number;
}

export interface Killfeed {
  header: { matchTime: number; kills: TeamPair; deaths: TeamPair; fightWins: TeamPair };
  blocks: KillfeedBlock[];
}

export const UNKNOWN_METHOD = "Unknown";

export function buildKillfeed(input: {
  map: MapLike;
  kills: KillLike[];
  rezzes: RezLike[];
  roundEnds: RoundEndLike[];
  durationSeconds: number;
}): Killfeed {
  const s = sides(input.map);
  const fights = groupFights(input.kills);
  const pair = (f: (team: string) => number): TeamPair => ({ ours: f(s.ours), theirs: f(s.theirs) });

  const header = {
    matchTime: input.durationSeconds,
    kills: pair((team) => fights.reduce((n, f) => n + (f.killsByTeam[team] ?? 0), 0)),
    deaths: pair((team) => input.kills.filter((k) => k.victimTeam === team).length),
    fightWins: pair((team) => fights.filter((f) => f.winner === team).length),
  };

  const rezByFight = new Map<number, RezLike[]>();
  for (const rez of input.rezzes) {
    const host =
      fights.find((f) => rez.matchTime >= f.start && rez.matchTime <= f.end) ??
      fights.find((f) => f.start > rez.matchTime) ??
      fights.at(-1);
    if (!host) continue;
    rezByFight.set(host.index, [...(rezByFight.get(host.index) ?? []), rez]);
  }

  const rounds = dedupeRounds(input.roundEnds);
  const blocks: KillfeedBlock[] = [];
  let next = 0;
  const pushRound = () => {
    blocks.push({ kind: "round", roundNumber: rounds[next].roundNumber, capturingTeam: roundCapturer(rounds[next], rounds[next - 1], input.map) });
    next += 1;
  };
  for (const fight of fights) {
    while (next < rounds.length && rounds[next].matchTime < fight.end) pushRound();
    blocks.push({ kind: "fight", fight, entries: entriesFor(fight, rezByFight.get(fight.index) ?? []) });
  }
  while (next < rounds.length) pushRound();

  return { header, blocks };
}

function actor(team: string, name: string, hero: string | undefined): Actor {
  return { team, name, hero: hero ?? "" };
}

function entriesFor(fight: Fight, rezzes: RezLike[]): KillfeedEntry[] {
  const entries: KillfeedEntry[] = fight.kills.map((k) => ({
    kind: killKind(k),
    time: k.matchTime,
    attacker: actor(k.attackerTeam, k.attackerName, k.attackerHero),
    victim: actor(k.victimTeam, k.victimName, k.victimHero),
    method: !k.eventAbility || k.eventAbility === "0" ? UNKNOWN_METHOD : k.eventAbility,
    critical: isFlagSet(k.isCriticalHit),
  }));
  for (const r of rezzes) {
    entries.push({
      kind: "rez",
      time: r.matchTime,
      resurrecter: actor(r.resurrecterTeam, r.resurrecterPlayer, r.resurrecterHero),
      resurrectee: actor(r.resurrecteeTeam, r.resurrecteePlayer, r.resurrecteeHero),
    });
  }
  return entries.sort((a, b) => a.time - b.time);
}
