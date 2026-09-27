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

  // Process kills and damage
  for (const r of [...rows.kills, ...rows.damage]) {
    if (r.attackerTeam === r.victimTeam && r.attackerName === r.victimName) {
      // Self-row: try victim first, fall back to attacker
      const victimPoint = parsePosition(r.victimPosition);
      if (victimPoint) {
        out.push({ t: r.matchTime, team: r.victimTeam, name: r.victimName, hero: r.victimHero ?? "", point: victimPoint });
      } else {
        const attackerPoint = parsePosition(r.attackerPosition);
        if (attackerPoint) {
          out.push({ t: r.matchTime, team: r.attackerTeam, name: r.attackerName, hero: r.attackerHero ?? "", point: attackerPoint });
        }
      }
    } else {
      // Distinct participants: emit up to two samples
      const attackerPoint = parsePosition(r.attackerPosition);
      if (attackerPoint) {
        out.push({ t: r.matchTime, team: r.attackerTeam, name: r.attackerName, hero: r.attackerHero ?? "", point: attackerPoint });
      }
      const victimPoint = parsePosition(r.victimPosition);
      if (victimPoint) {
        out.push({ t: r.matchTime, team: r.victimTeam, name: r.victimName, hero: r.victimHero ?? "", point: victimPoint });
      }
    }
  }

  // Process healing
  for (const r of rows.healing) {
    if (r.healerTeam === r.healeeTeam && r.healerName === r.healeeName) {
      // Self-row: try healee first, fall back to healer
      const healeePoint = parsePosition(r.healeePosition);
      if (healeePoint) {
        out.push({ t: r.matchTime, team: r.healeeTeam, name: r.healeeName, hero: r.healeeHero ?? "", point: healeePoint });
      } else {
        const healerPoint = parsePosition(r.healerPosition);
        if (healerPoint) {
          out.push({ t: r.matchTime, team: r.healerTeam, name: r.healerName, hero: r.healerHero ?? "", point: healerPoint });
        }
      }
    } else {
      // Distinct participants: emit up to two samples
      const healerPoint = parsePosition(r.healerPosition);
      if (healerPoint) {
        out.push({ t: r.matchTime, team: r.healerTeam, name: r.healerName, hero: r.healerHero ?? "", point: healerPoint });
      }
      const healeePoint = parsePosition(r.healeePosition);
      if (healeePoint) {
        out.push({ t: r.matchTime, team: r.healeeTeam, name: r.healeeName, hero: r.healeeHero ?? "", point: healeePoint });
      }
    }
  }

  // Process ability and ultimate events
  for (const r of [...rows.ability1, ...rows.ability2, ...rows.ultEnds]) {
    const point = parsePosition(r.playerPosition);
    if (point) {
      out.push({ t: r.matchTime, team: r.playerTeam, name: r.playerName, hero: r.playerHero ?? "", point });
    }
  }

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
