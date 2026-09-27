import type { KillLike } from "./fights";
import { parsePosition, type Point } from "./positions";
import { windowIndexAt, type StageWindow } from "./stages";

export const SAMPLE_STEP_SECONDS = 0.5;
export const TRACK_GAP_SECONDS = 6;
export const DEATH_MARKER_SECONDS = 10;

export interface PositionSample {
  t: number;
  team: string;
  name: string;
  hero: string;
  point: Point;
}

export interface PlayerPosLike {
  matchTime: number;
  playerTeam: string;
  playerName: string;
  playerHero: string | null;
  playerPosition: string | null;
}

/** kill and damage rows: two participants, two tuples. */
export interface PairPosLike {
  matchTime: number;
  attackerTeam: string;
  attackerName: string;
  attackerHero: string;
  victimTeam: string;
  victimName: string;
  victimHero: string;
  attackerPosition: string | null;
  victimPosition: string | null;
}

export interface HealPosLike {
  matchTime: number;
  healerTeam: string;
  healerName: string;
  healerHero: string;
  healeeTeam: string;
  healeeName: string;
  healeeHero: string;
  healerPosition: string | null;
  healeePosition: string | null;
}

export interface TrackRows {
  kills: PairPosLike[];
  damage: PairPosLike[];
  healing: HealPosLike[];
  ability1: PlayerPosLike[];
  ability2: PlayerPosLike[];
  ultEnds: PlayerPosLike[];
}

/** One sample per parseable tuple, across every row kind that carries a position, in time order. */
export function collectSamples(rows: TrackRows): PositionSample[] {
  const out: PositionSample[] = [];
  const push = (t: number, team: string, name: string, hero: string | null, raw: string | null) => {
    const point = parsePosition(raw);
    if (point) out.push({ t, team, name, hero: hero ?? "", point });
  };
  for (const r of [...rows.kills, ...rows.damage]) {
    push(r.matchTime, r.attackerTeam, r.attackerName, r.attackerHero, r.attackerPosition);
    if (!(r.attackerTeam === r.victimTeam && r.attackerName === r.victimName)) push(r.matchTime, r.victimTeam, r.victimName, r.victimHero, r.victimPosition);
  }
  for (const r of rows.healing) {
    push(r.matchTime, r.healerTeam, r.healerName, r.healerHero, r.healerPosition);
    if (!(r.healerTeam === r.healeeTeam && r.healerName === r.healeeName)) push(r.matchTime, r.healeeTeam, r.healeeName, r.healeeHero, r.healeePosition);
  }
  for (const r of [...rows.ability1, ...rows.ability2, ...rows.ultEnds]) push(r.matchTime, r.playerTeam, r.playerName, r.playerHero, r.playerPosition);
  return out.sort((a, b) => a.t - b.t);
}

export type Sample = [t: number, x: number, z: number];

export interface Segment {
  /** Index into the map's StageWindow[]; the client projects the segment through that window's stage. */
  window: number;
  samples: Sample[];
}

export interface Track {
  team: string;
  name: string;
  segments: Segment[];
}

const key = (team: string, name: string) => `${team}|${name}`;
const round = (v: number, places: number) => Number(v.toFixed(places));

/**
 * Buckets each player's samples at SAMPLE_STEP_SECONDS (last sample in a bucket wins) and cuts the run into
 * segments at gaps over TRACK_GAP_SECONDS, at the player's deaths, and at window changes.
 */
export function buildTracks(samples: PositionSample[], kills: KillLike[], windows: StageWindow[], roster: Array<{ team: string; name: string }> = []): Track[] {
  const players = new Map<string, { team: string; name: string }>();
  for (const p of roster) players.set(key(p.team, p.name), { team: p.team, name: p.name });
  for (const s of samples) players.set(key(s.team, s.name), { team: s.team, name: s.name });

  const bucketed = new Map<string, Map<number, PositionSample>>();
  for (const s of samples) {
    const buckets = bucketed.get(key(s.team, s.name)) ?? new Map<number, PositionSample>();
    buckets.set(Math.floor(s.t / SAMPLE_STEP_SECONDS), s);
    bucketed.set(key(s.team, s.name), buckets);
  }
  const deaths = new Map<string, number[]>();
  for (const k of kills) {
    const id = key(k.victimTeam, k.victimName);
    deaths.set(id, [...(deaths.get(id) ?? []), k.matchTime]);
  }

  const tracks: Track[] = [];
  for (const [id, p] of players) {
    const ordered = [...(bucketed.get(id)?.values() ?? [])].sort((a, b) => a.t - b.t);
    const died = deaths.get(id) ?? [];
    const segments: Segment[] = [];
    let current: Segment | null = null;
    let prev: PositionSample | null = null;
    for (const s of ordered) {
      const window = windowIndexAt(s.t, windows);
      const cut =
        !current ||
        !prev ||
        s.t - prev.t > TRACK_GAP_SECONDS ||
        window !== current.window ||
        died.some((d) => d >= prev!.t && d < s.t);
      if (cut) {
        current = { window, samples: [] };
        segments.push(current);
      }
      current!.samples.push([round(s.t, 2), round(s.point.x, 1), round(s.point.z, 1)]);
      prev = s;
    }
    tracks.push({ team: p.team, name: p.name, segments });
  }
  return tracks.sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
}
