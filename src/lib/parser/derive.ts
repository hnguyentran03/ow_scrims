import { ParseError } from "./errors";
import type { ParsedLog } from "./parse";

export const MAP_TYPES = ["Clash", "Control", "Escort", "Flashpoint", "Hybrid", "Push"] as const;
export type MapType = (typeof MAP_TYPES)[number];
export type Side = 1 | 2;

export interface MapMeta {
  mapName: string;
  mapType: MapType;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  durationSeconds: number;
  roundCount: number;
  winnerSide: Side | null;
}

export interface WinnerInput {
  mapType: MapType;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  captures: Array<{ capturingTeam: string; matchTimeRemaining: number }>;
}

function byScore(team1Score: number, team2Score: number): Side | null {
  if (team1Score > team2Score) return 1;
  if (team2Score > team1Score) return 2;
  return null;
}

export function deriveWinner(input: WinnerInput): Side | null {
  const { mapType, team1Score, team2Score } = input;
  if (mapType === "Push") return null;
  if (mapType === "Control" || mapType === "Flashpoint" || mapType === "Clash") {
    return byScore(team1Score, team2Score);
  }
  // Escort and Hybrid: score first, then Parsertime's capture tie-break.
  const scored = byScore(team1Score, team2Score);
  if (scored !== null) return scored;
  const c1 = input.captures.filter((c) => c.capturingTeam === input.team1Name);
  const c2 = input.captures.filter((c) => c.capturingTeam === input.team2Name);
  if (c1.length === 0 && c2.length === 0) return null;
  if (c1.length === 0) return 2;
  if (c2.length === 0) return 1;
  if (c1.length !== c2.length) return c1.length > c2.length ? 1 : 2;
  const last1 = c1[c1.length - 1].matchTimeRemaining;
  const last2 = c2[c2.length - 1].matchTimeRemaining;
  return last1 > last2 ? 1 : 2;
}

const VARIANT_SUFFIX = /\s*\([^)]*\)\s*$/;

/** Seasonal variants are the same map: "Lijiang Tower (Lunar New Year)" is stored as "Lijiang Tower". */
const SMALL_WORDS = new Set(["of", "the", "de", "du", "la"]);

/** The Workshop writes a few map names in capitals ("NEON JUNCTION"); title-case a name that has no lowercase letter at all, keeping small words lowercase after the first. */
function titleCaseIfShouting(name: string): string {
  if (/\p{Ll}/u.test(name)) return name;
  return name
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.replace(/^\p{L}/u, (c) => c.toUpperCase())))
    .join(" ");
}

/** The stored map name: seasonal variant stripped, shouting names title-cased. */
export function baseMapName(name: string): string {
  return titleCaseIfShouting(name.replace(VARIANT_SUFFIX, "").trim());
}

function isMapType(s: unknown): s is MapType {
  return typeof s === "string" && (MAP_TYPES as readonly string[]).includes(s);
}

export function deriveMapMeta(parsed: ParsedLog): MapMeta {
  const start = parsed.events.match_start?.[0];
  const end = parsed.events.match_end?.[0];
  if (!start || !end) throw new ParseError("log has no match_start or match_end");

  const mapType = start.mapType;
  if (!isMapType(mapType)) throw new ParseError(`unknown map type "${String(mapType)}"`);

  const team1Name = String(start.team1Name);
  const team2Name = String(start.team2Name);
  const team1Score = Number(end.team1Score);
  const team2Score = Number(end.team2Score);

  const captures = (parsed.events.objective_captured ?? []).map((row) => ({
    capturingTeam: String(row.capturingTeam),
    matchTimeRemaining: Number(row.matchTimeRemaining),
  }));

  return {
    mapName: baseMapName(String(start.mapName)),
    mapType,
    team1Name,
    team2Name,
    team1Score,
    team2Score,
    durationSeconds: Number(end.matchTime),
    roundCount: Number(end.roundNumber),
    winnerSide: deriveWinner({ mapType, team1Name, team2Name, team1Score, team2Score, captures }),
  };
}
