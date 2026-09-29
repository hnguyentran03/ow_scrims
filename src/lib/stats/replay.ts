import { fitBounds, type Affine } from "./calibration";
import { buildEvents, type EventEntry, type EventMapLike, type EventRows } from "./events";
import { killKind, type KillKind, type KillLike } from "./fights";
import type { RezLike } from "./killfeed";
import { finalRoundRows, type PlayerStatLike } from "./overview";
import { parsePosition } from "./positions";
import { sideOf, type SideKey, type Sides } from "./sides";
import { stageWindows, windowIndexAt, windowLabel, type ObjectiveUpdateLike, type RoundStartLike } from "./stages";
import { buildTracks, collectSamples, type PairPosLike, type PlayerPosLike, type Segment, type TrackRows } from "./tracks";
import { pairUltimates, type UltLike } from "./ultimates";

/** An ult cast is placed at the caster's nearest positioned sample within this many seconds of the start. */
export const ULT_PROXY_SECONDS = 3;

/** A kill line is drawn from attacker to victim for this long after the kill. */
export const KILL_LINE_SECONDS = 2;
/** An ult ring stays on the caster for the ult's span, or this long when no end was logged. */
export const ULT_RING_SECONDS = 5;

export interface CalibratedImage {
  stage: number;
  id: number;
  width: number;
  height: number;
  affine: Affine;
}

export interface ReplayStage {
  stage: number;
  roundNumber: number;
  label: string;
  start: number;
  end: number;
  image: Omit<CalibratedImage, "stage"> | null;
  /** fitBounds over this window's samples; the projection when `image` is null. */
  bounds: Affine;
}

export interface ReplayPlayer {
  team: string;
  name: string;
  side: SideKey | null;
  segments: Segment[];
}

export interface HeroChange {
  team: string;
  name: string;
  t: number;
  hero: string;
}

export interface ReplayDeath {
  t: number;
  team: string;
  name: string;
  x: number | null;
  z: number | null;
}

export interface Participant {
  team: string;
  name: string;
  hero: string;
  x: number | null;
  z: number | null;
}

export interface ReplayKill {
  t: number;
  kind: KillKind;
  attacker: Participant | null;
  victim: Participant;
  method: string;
}

export interface ReplayUlt {
  team: string;
  name: string;
  hero: string;
  start: number;
  end: number | null;
  x: number | null;
  z: number | null;
}

export interface UltState {
  team: string;
  name: string;
  t: number;
  state: "charged" | "used";
}

export type FeedEntry =
  | EventEntry
  | { kind: "kill"; time: number; team: SideKey | null; attacker: string; attackerHero: string; victim: string; victimHero: string; killKind: KillKind }
  | { kind: "rez"; time: number; team: SideKey | null; player: string; target: string };

export interface Replay {
  durationSeconds: number;
  hasPositions: boolean;
  stages: ReplayStage[];
  players: ReplayPlayer[];
  heroes: HeroChange[];
  deaths: ReplayDeath[];
  kills: ReplayKill[];
  ults: ReplayUlt[];
  ultStates: UltState[];
  feed: FeedEntry[];
}

export interface ReplayMapLike extends EventMapLike {
  mapName: string;
  durationSeconds: number;
}

interface HeroRowLike {
  matchTime: number;
  playerTeam: string;
  playerName: string;
  playerHero: string;
}

export type ReplayRowsLike = Omit<EventRows, "kills" | "ultEnds"> &
  Omit<TrackRows, "kills" | "ultEnds"> & {
    kills: Array<KillLike & PairPosLike>;
    ultEnds: Array<UltLike & PlayerPosLike>;
    rezzes: RezLike[];
    ultCharged: UltLike[];
    heroSpawns: HeroRowLike[];
    heroSwaps: HeroRowLike[];
    roundStarts: RoundStartLike[];
    objectiveUpdated: ObjectiveUpdateLike[];
    playerStats: PlayerStatLike[];
  };

const ground = (raw: string | null | undefined): { x: number | null; z: number | null } => {
  const p = parsePosition(raw);
  return p ? { x: p.x, z: p.z } : { x: null, z: null };
};

export function buildReplay(input: { map: ReplayMapLike; sides: Sides; rows: ReplayRowsLike; images: CalibratedImage[] }): Replay {
  const { map, sides: s, rows, images } = input;
  const side = (team: string) => sideOf(team, s);
  const windows = stageWindows({ mapType: map.mapType, roundStarts: rows.roundStarts, roundEnds: rows.roundEnds, objectiveUpdated: rows.objectiveUpdated, durationSeconds: map.durationSeconds });

  const samples = collectSamples(rows);
  const roster = finalRoundRows(rows.playerStats).map((r) => ({ team: r.playerTeam, name: r.playerName }));
  const tracks = buildTracks(samples, rows.kills, windows, roster);

  const stages: ReplayStage[] = windows.map((w, i) => {
    const inWindow = samples.filter((smp) => windowIndexAt(smp.t, windows) === i).map((smp) => ({ x: smp.point.x, z: smp.point.z }));
    const image = images.find((img) => img.stage === w.stage);
    return {
      ...w,
      label: windowLabel(map, w),
      image: image ? { id: image.id, width: image.width, height: image.height, affine: image.affine } : null,
      bounds: fitBounds(inWindow),
    };
  });

  const players: ReplayPlayer[] = tracks.map((t) => ({ team: t.team, name: t.name, side: side(t.team), segments: t.segments }));

  const heroes: HeroChange[] = [...rows.heroSpawns, ...rows.heroSwaps]
    .map((r) => ({ team: r.playerTeam, name: r.playerName, t: r.matchTime, hero: r.playerHero }))
    .sort((a, b) => a.t - b.t);

  const deaths: ReplayDeath[] = rows.kills.map((k) => ({ t: k.matchTime, team: k.victimTeam, name: k.victimName, ...ground(k.victimPosition) }));

  const kills: ReplayKill[] = rows.kills.map((k) => {
    const kind = killKind(k);
    return {
      t: k.matchTime,
      kind,
      attacker: kind === "kill" ? { team: k.attackerTeam, name: k.attackerName, hero: k.attackerHero, ...ground(k.attackerPosition) } : null,
      victim: { team: k.victimTeam, name: k.victimName, hero: k.victimHero, ...ground(k.victimPosition) },
      method: k.eventAbility ?? "",
    };
  });

  const pairs = pairUltimates(rows.ultStarts, rows.ultEnds);
  const ults: ReplayUlt[] = pairs.map(({ start, end }) => {
    const mine = samples.filter((smp) => smp.team === start.playerTeam && smp.name === start.playerName && Math.abs(smp.t - start.matchTime) <= ULT_PROXY_SECONDS);
    const nearest = mine.reduce<(typeof mine)[number] | null>((best, smp) => (!best || Math.abs(smp.t - start.matchTime) < Math.abs(best.t - start.matchTime) ? smp : best), null);
    // `end` is the same object as the ultimate_end row, so its position is still on it; pairUltimates just types it as UltLike.
    const endPos = end ? ground((end as UltLike & PlayerPosLike).playerPosition) : { x: null, z: null };
    const pos = nearest ? { x: nearest.point.x, z: nearest.point.z } : endPos;
    return { team: start.playerTeam, name: start.playerName, hero: start.playerHero ?? "", start: start.matchTime, end: end?.matchTime ?? null, ...pos };
  });

  const ultStates: UltState[] = [
    ...rows.ultCharged.map((c) => ({ team: c.playerTeam, name: c.playerName, t: c.matchTime, state: "charged" as const })),
    ...pairs.map(({ start }) => ({ team: start.playerTeam, name: start.playerName, t: start.matchTime, state: "used" as const })),
  ].sort((a, b) => a.t - b.t);

  const feed: FeedEntry[] = [
    // The kill-level feed entries below already cover ult kills and multikills; drop the duplicate
    // ult_kill/multikill lines buildEvents produces for the events tab.
    ...buildEvents(map, rows).entries.filter((e) => e.kind !== "ult_kill" && e.kind !== "multikill"),
    ...kills.map((k): FeedEntry => ({
      kind: "kill", time: k.t, team: k.attacker ? side(k.attacker.team) : side(k.victim.team),
      attacker: k.attacker?.name ?? k.victim.name, attackerHero: k.attacker?.hero ?? k.victim.hero, victim: k.victim.name, victimHero: k.victim.hero, killKind: k.kind,
    })),
    ...rows.rezzes.map((r): FeedEntry => ({ kind: "rez", time: r.matchTime, team: side(r.resurrecterTeam), player: r.resurrecterPlayer, target: r.resurrecteePlayer })),
  ].sort((a, b) => a.time - b.time);

  return { durationSeconds: map.durationSeconds, hasPositions: samples.length > 0, stages, players, heroes, deaths, kills, ults, ultStates, feed };
}
