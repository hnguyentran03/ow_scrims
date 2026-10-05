/**
 * Name anonymisation for the public snapshot. Pure functions here; the database
 * sweep that applies them is in anonymise-db.ts and is driven by scripts/push-snapshot.ts.
 */

export const SENTINELS: readonly string[] = ["0", ""];
export const DEFAULT_TEAM_LABELS: readonly string[] = ["Team 1", "Team 2"];

export interface Column {
  table: string;
  column: string;
}

const cols = (table: string, ...columns: string[]): Column[] => columns.map((column) => ({ table, column }));

const PLAYER_NAME_TABLES = [
  "ability_1_used", "ability_2_used", "defensive_assist", "dva_remech", "echo_duplicate_end", "echo_duplicate_start",
  "hero_spawn", "hero_swap", "offensive_assist", "player_stat", "remech_charged", "ultimate_charged", "ultimate_end", "ultimate_start",
];

/** Every column holding a player's name. The schema test fails if a text column is left out of all three lists. */
export const PLAYER_COLUMNS: Column[] = [
  ...PLAYER_NAME_TABLES.flatMap((t) => cols(t, "player_name")),
  ...cols("damage", "attacker_name", "victim_name"),
  ...cols("kill", "attacker_name", "victim_name"),
  ...cols("healing", "healer_name", "healee_name"),
  ...cols("mercy_rez", "resurrecter_player", "resurrectee_player"),
];

export const TEAM_COLUMNS: Column[] = [
  ...cols("map", "team1_name", "team2_name"),
  ...cols("match_start", "team_1_name", "team_2_name"),
  ...cols("scrim", "opponent_name"),
];

const HERO_TEAM = (t: string, extra: string[] = []) => cols(t, "player_hero", "player_team", ...extra);

/** Text columns that are not names and are never rewritten. scrim.name is handled separately by rewriteScrimName. */
export const OTHER_TEXT_COLUMNS: Column[] = [
  ...cols("scrim", "name"),
  ...cols("map", "map_name", "map_type", "original_filename", "raw_log_path", "winner_source"),
  ...cols("map_ban", "hero"),
  ...cols("map_image", "calibration", "content_type", "filename", "map_name"),
  ...cols("match_start", "map_name", "map_type"),
  ...HERO_TEAM("ability_1_used", ["hero_duplicated", "player_position"]),
  ...HERO_TEAM("ability_2_used", ["hero_duplicated", "player_position"]),
  ...cols("damage", "attacker_hero", "attacker_position", "attacker_team", "event_ability", "is_critical_hit", "is_environmental", "victim_hero", "victim_position", "victim_team"),
  ...HERO_TEAM("defensive_assist", ["hero_duplicated"]),
  ...HERO_TEAM("dva_remech"),
  ...HERO_TEAM("echo_duplicate_end"),
  ...HERO_TEAM("echo_duplicate_start", ["hero_duplicated"]),
  ...cols("healing", "event_ability", "healee_hero", "healee_position", "healee_team", "healer_hero", "healer_position", "healer_team", "is_health_pack"),
  ...HERO_TEAM("hero_spawn"),
  ...HERO_TEAM("hero_swap", ["previous_hero"]),
  ...cols("kill", "assist_count", "attacker_hero", "attacker_position", "attacker_team", "event_ability", "is_critical_hit", "is_environmental", "victim_hero", "victim_position", "victim_team"),
  ...cols("mercy_rez", "resurrectee_hero", "resurrectee_team", "resurrecter_hero", "resurrecter_team"),
  ...cols("objective_captured", "capturing_team"),
  ...HERO_TEAM("offensive_assist", ["hero_duplicated"]),
  ...cols("payload_progress", "capturing_team"),
  ...HERO_TEAM("player_stat"),
  ...cols("point_progress", "capturing_team"),
  ...HERO_TEAM("remech_charged", ["hero_duplicated"]),
  ...cols("round_end", "capturing_team"),
  ...cols("round_start", "capturing_team"),
  ...HERO_TEAM("ultimate_charged", ["hero_duplicated"]),
  ...HERO_TEAM("ultimate_end", ["hero_duplicated", "player_position"]),
  ...HERO_TEAM("ultimate_start", ["hero_duplicated", "player_position"]),
];

export type AliasMap = { names: Record<string, string> };

export function isSkipped(value: string): boolean {
  return SENTINELS.includes(value) || DEFAULT_TEAM_LABELS.includes(value);
}

const CONSONANTS = "bdfgklmnprstvz";
const VOWELS = "aeiou";
const MIN_LEN = 5;
const MAX_LEN = 9;

/**
 * First character kept as-is; then alternating consonant/vowel pairs in lower case
 * until the length lands between 5 and 9. Retries until the result is not in
 * `taken` (compared case-insensitively). The caller seeds `taken` with every real
 * name and every existing pseudonym.
 */
export function pseudonym(real: string, taken: Set<string>, random: () => number = Math.random): string {
  const lower = new Set([...taken].map((s) => s.toLowerCase()));
  const first = real[0] ?? "x";
  for (;;) {
    const target = MIN_LEN + Math.floor(random() * (MAX_LEN - MIN_LEN + 1));
    let out = first;
    while (out.length < target) {
      out += CONSONANTS[Math.floor(random() * CONSONANTS.length)];
      if (out.length < target) out += VOWELS[Math.floor(random() * VOWELS.length)];
    }
    if (!lower.has(out.toLowerCase())) return out;
  }
}

/** Adds a pseudonym for every real name not already mapped. Mutates `map`; returns what was added. */
export function extendAliasMap(map: AliasMap, reals: Iterable<string>, random: () => number = Math.random): { added: Record<string, string> } {
  const list = [...reals];
  const taken = new Set<string>([...Object.keys(map.names), ...Object.values(map.names), ...list]);
  const added: Record<string, string> = {};
  for (const real of list) {
    if (real in map.names || isSkipped(real)) continue;
    const p = pseudonym(real, taken, random);
    map.names[real] = p;
    added[real] = p;
    taken.add(p);
  }
  return { added };
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replaces every mapped name inside a scrim name, longest first, case-insensitively, as a plain substring, in a single pass. */
export function rewriteScrimName(name: string, map: AliasMap): string {
  const reals = Object.keys(map.names).filter((r) => r.length > 0).sort((a, b) => b.length - a.length);
  if (reals.length === 0) return name;
  const byLower = new Map(reals.map((real) => [real.toLowerCase(), map.names[real]]));
  const pattern = new RegExp(reals.map(escapeRe).join("|"), "gi");
  return name.replace(pattern, (match) => byLower.get(match.toLowerCase()) ?? match);
}
