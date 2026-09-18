import { date, doublePrecision, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { EventType } from "@/lib/parser/events";

export const scrims = pgTable("scrim", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  opponentName: text("opponent_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const maps = pgTable(
  "map",
  {
    id: serial("id").primaryKey(),
    scrimId: integer("scrim_id").notNull().references(() => scrims.id, { onDelete: "cascade" }),
    order: integer("map_order").notNull(),
    mapName: text("map_name").notNull(),
    mapType: text("map_type").notNull(),
    team1Name: text("team1_name").notNull(),
    team2Name: text("team2_name").notNull(),
    ourSide: integer("our_side").notNull(),
    winnerSide: integer("winner_side"),
    winnerSource: text("winner_source"),
    team1Score: integer("team1_score").notNull(),
    team2Score: integer("team2_score").notNull(),
    durationSeconds: doublePrecision("duration_seconds").notNull(),
    roundCount: integer("round_count").notNull(),
    rawLogPath: text("raw_log_path"),
    originalFilename: text("original_filename").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("map_scrim_id_idx").on(t.scrimId)],
);

const base = () => ({
  id: serial("id").primaryKey(),
  mapId: integer("map_id").notNull().references(() => maps.id, { onDelete: "cascade" }),
});

export const ability1Used = pgTable(
  "ability_1_used",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    heroDuplicated: text("hero_duplicated").notNull(),
    playerPosition: text("player_position"),
  },
  (t) => [index("ability_1_used_map_id_idx").on(t.mapId)],
);

export const ability2Used = pgTable(
  "ability_2_used",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    heroDuplicated: text("hero_duplicated").notNull(),
    playerPosition: text("player_position"),
  },
  (t) => [index("ability_2_used_map_id_idx").on(t.mapId)],
);

export const damage = pgTable(
  "damage",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    attackerTeam: text("attacker_team").notNull(),
    attackerName: text("attacker_name").notNull(),
    attackerHero: text("attacker_hero").notNull(),
    victimTeam: text("victim_team").notNull(),
    victimName: text("victim_name").notNull(),
    victimHero: text("victim_hero").notNull(),
    eventAbility: text("event_ability").notNull(),
    eventDamage: doublePrecision("event_damage").notNull(),
    isCriticalHit: text("is_critical_hit").notNull(),
    isEnvironmental: text("is_environmental").notNull(),
    attackerPosition: text("attacker_position"),
    victimPosition: text("victim_position"),
  },
  (t) => [index("damage_map_id_idx").on(t.mapId)],
);

export const defensiveAssist = pgTable(
  "defensive_assist",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    heroDuplicated: text("hero_duplicated").notNull(),
  },
  (t) => [index("defensive_assist_map_id_idx").on(t.mapId)],
);

export const dvaRemech = pgTable(
  "dva_remech",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    ultimateId: integer("ultimate_id").notNull(),
  },
  (t) => [index("dva_remech_map_id_idx").on(t.mapId)],
);

export const echoDuplicateEnd = pgTable(
  "echo_duplicate_end",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    ultimateId: integer("ultimate_id").notNull(),
  },
  (t) => [index("echo_duplicate_end_map_id_idx").on(t.mapId)],
);

export const echoDuplicateStart = pgTable(
  "echo_duplicate_start",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    heroDuplicated: text("hero_duplicated").notNull(),
    ultimateId: integer("ultimate_id").notNull(),
  },
  (t) => [index("echo_duplicate_start_map_id_idx").on(t.mapId)],
);

export const healing = pgTable(
  "healing",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    healerTeam: text("healer_team").notNull(),
    healerName: text("healer_name").notNull(),
    healerHero: text("healer_hero").notNull(),
    healeeTeam: text("healee_team").notNull(),
    healeeName: text("healee_name").notNull(),
    healeeHero: text("healee_hero").notNull(),
    eventAbility: text("event_ability").notNull(),
    eventHealing: doublePrecision("event_healing").notNull(),
    isHealthPack: text("is_health_pack").notNull(),
    healerPosition: text("healer_position"),
    healeePosition: text("healee_position"),
  },
  (t) => [index("healing_map_id_idx").on(t.mapId)],
);

export const heroSpawn = pgTable(
  "hero_spawn",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    previousHero: integer("previous_hero"),
    heroTimePlayed: doublePrecision("hero_time_played").notNull(),
  },
  (t) => [index("hero_spawn_map_id_idx").on(t.mapId)],
);

export const heroSwap = pgTable(
  "hero_swap",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    previousHero: text("previous_hero").notNull(),
    heroTimePlayed: doublePrecision("hero_time_played").notNull(),
  },
  (t) => [index("hero_swap_map_id_idx").on(t.mapId)],
);

export const kill = pgTable(
  "kill",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    attackerTeam: text("attacker_team").notNull(),
    attackerName: text("attacker_name").notNull(),
    attackerHero: text("attacker_hero").notNull(),
    victimTeam: text("victim_team").notNull(),
    victimName: text("victim_name").notNull(),
    victimHero: text("victim_hero").notNull(),
    eventAbility: text("event_ability").notNull(),
    eventDamage: doublePrecision("event_damage").notNull(),
    isCriticalHit: text("is_critical_hit").notNull(),
    isEnvironmental: text("is_environmental").notNull(),
    assistCount: text("assist_count"),
    attackerPosition: text("attacker_position"),
    victimPosition: text("victim_position"),
  },
  (t) => [index("kill_map_id_idx").on(t.mapId)],
);

export const matchEnd = pgTable(
  "match_end",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    team1Score: integer("team_1_score").notNull(),
    team2Score: integer("team_2_score").notNull(),
  },
  (t) => [index("match_end_map_id_idx").on(t.mapId)],
);

export const matchStart = pgTable(
  "match_start",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    mapName: text("map_name").notNull(),
    mapType: text("map_type").notNull(),
    team1Name: text("team_1_name").notNull(),
    team2Name: text("team_2_name").notNull(),
  },
  (t) => [index("match_start_map_id_idx").on(t.mapId)],
);

export const mercyRez = pgTable(
  "mercy_rez",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    resurrecterTeam: text("resurrecter_team").notNull(),
    resurrecterPlayer: text("resurrecter_player").notNull(),
    resurrecterHero: text("resurrecter_hero").notNull(),
    resurrecteeTeam: text("resurrectee_team").notNull(),
    resurrecteePlayer: text("resurrectee_player").notNull(),
    resurrecteeHero: text("resurrectee_hero").notNull(),
  },
  (t) => [index("mercy_rez_map_id_idx").on(t.mapId)],
);

export const objectiveCaptured = pgTable(
  "objective_captured",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    capturingTeam: text("capturing_team").notNull(),
    objectiveIndex: integer("objective_index").notNull(),
    controlTeam1Progress: doublePrecision("control_team_1_progress").notNull(),
    controlTeam2Progress: doublePrecision("control_team_2_progress").notNull(),
    matchTimeRemaining: doublePrecision("match_time_remaining").notNull(),
  },
  (t) => [index("objective_captured_map_id_idx").on(t.mapId)],
);

export const objectiveUpdated = pgTable(
  "objective_updated",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    previousObjectiveIndex: integer("previous_objective_index").notNull(),
    currentObjectiveIndex: integer("current_objective_index").notNull(),
  },
  (t) => [index("objective_updated_map_id_idx").on(t.mapId)],
);

export const offensiveAssist = pgTable(
  "offensive_assist",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    heroDuplicated: text("hero_duplicated").notNull(),
  },
  (t) => [index("offensive_assist_map_id_idx").on(t.mapId)],
);

export const payloadProgress = pgTable(
  "payload_progress",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    capturingTeam: text("capturing_team").notNull(),
    objectiveIndex: integer("objective_index").notNull(),
    payloadCaptureProgress: doublePrecision("payload_capture_progress").notNull(),
  },
  (t) => [index("payload_progress_map_id_idx").on(t.mapId)],
);

export const playerStat = pgTable(
  "player_stat",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    eliminations: integer("eliminations").notNull(),
    finalBlows: integer("final_blows").notNull(),
    deaths: integer("deaths").notNull(),
    allDamageDealt: doublePrecision("all_damage_dealt").notNull(),
    barrierDamageDealt: doublePrecision("barrier_damage_dealt").notNull(),
    heroDamageDealt: doublePrecision("hero_damage_dealt").notNull(),
    healingDealt: doublePrecision("healing_dealt").notNull(),
    healingReceived: doublePrecision("healing_received").notNull(),
    selfHealing: doublePrecision("self_healing").notNull(),
    damageTaken: doublePrecision("damage_taken").notNull(),
    damageBlocked: doublePrecision("damage_blocked").notNull(),
    defensiveAssists: integer("defensive_assists").notNull(),
    offensiveAssists: integer("offensive_assists").notNull(),
    ultimatesEarned: integer("ultimates_earned").notNull(),
    ultimatesUsed: integer("ultimates_used").notNull(),
    multikillBest: integer("multikill_best").notNull(),
    multikills: integer("multikills").notNull(),
    soloKills: integer("solo_kills").notNull(),
    objectiveKills: integer("objective_kills").notNull(),
    environmentalKills: integer("environmental_kills").notNull(),
    environmentalDeaths: integer("environmental_deaths").notNull(),
    criticalHits: integer("critical_hits").notNull(),
    criticalHitAccuracy: doublePrecision("critical_hit_accuracy").notNull(),
    scopedAccuracy: doublePrecision("scoped_accuracy").notNull(),
    scopedCriticalHitAccuracy: doublePrecision("scoped_critical_hit_accuracy").notNull(),
    scopedCriticalHitKills: integer("scoped_critical_hit_kills").notNull(),
    shotsFired: integer("shots_fired").notNull(),
    shotsHit: integer("shots_hit").notNull(),
    shotsMissed: integer("shots_missed").notNull(),
    scopedShotsFired: integer("scoped_shots_fired").notNull(),
    scopedShotsHit: integer("scoped_shots_hit").notNull(),
    weaponAccuracy: doublePrecision("weapon_accuracy").notNull(),
    heroTimePlayed: doublePrecision("hero_time_played").notNull(),
  },
  (t) => [index("player_stat_map_id_idx").on(t.mapId), index("player_stat_map_round_idx").on(t.mapId, t.roundNumber)],
);

export const pointProgress = pgTable(
  "point_progress",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    capturingTeam: text("capturing_team").notNull(),
    objectiveIndex: integer("objective_index").notNull(),
    pointCaptureProgress: doublePrecision("point_capture_progress").notNull(),
  },
  (t) => [index("point_progress_map_id_idx").on(t.mapId)],
);

export const remechCharged = pgTable(
  "remech_charged",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    heroDuplicated: text("hero_duplicated").notNull(),
    ultimateId: integer("ultimate_id").notNull(),
  },
  (t) => [index("remech_charged_map_id_idx").on(t.mapId)],
);

export const roundEnd = pgTable(
  "round_end",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    capturingTeam: text("capturing_team").notNull(),
    team1Score: integer("team_1_score").notNull(),
    team2Score: integer("team_2_score").notNull(),
    objectiveIndex: integer("objective_index").notNull(),
    controlTeam1Progress: doublePrecision("control_team_1_progress").notNull(),
    controlTeam2Progress: doublePrecision("control_team_2_progress").notNull(),
    matchTimeRemaining: doublePrecision("match_time_remaining").notNull(),
  },
  (t) => [index("round_end_map_id_idx").on(t.mapId)],
);

export const roundStart = pgTable(
  "round_start",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    capturingTeam: text("capturing_team").notNull(),
    team1Score: integer("team_1_score").notNull(),
    team2Score: integer("team_2_score").notNull(),
    objectiveIndex: integer("objective_index").notNull(),
  },
  (t) => [index("round_start_map_id_idx").on(t.mapId)],
);

export const setupComplete = pgTable(
  "setup_complete",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    roundNumber: integer("round_number").notNull(),
    matchTimeRemaining: doublePrecision("match_time_remaining").notNull(),
  },
  (t) => [index("setup_complete_map_id_idx").on(t.mapId)],
);

export const ultimateCharged = pgTable(
  "ultimate_charged",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    heroDuplicated: text("hero_duplicated").notNull(),
    ultimateId: integer("ultimate_id").notNull(),
  },
  (t) => [index("ultimate_charged_map_id_idx").on(t.mapId)],
);

export const ultimateEnd = pgTable(
  "ultimate_end",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero"),
    heroDuplicated: text("hero_duplicated").notNull(),
    ultimateId: integer("ultimate_id").notNull(),
    playerPosition: text("player_position"),
  },
  (t) => [index("ultimate_end_map_id_idx").on(t.mapId)],
);

export const ultimateStart = pgTable(
  "ultimate_start",
  {
    ...base(),
    matchTime: doublePrecision("match_time").notNull(),
    playerTeam: text("player_team").notNull(),
    playerName: text("player_name").notNull(),
    playerHero: text("player_hero").notNull(),
    heroDuplicated: text("hero_duplicated").notNull(),
    ultimateId: integer("ultimate_id").notNull(),
    playerPosition: text("player_position"),
  },
  (t) => [index("ultimate_start_map_id_idx").on(t.mapId)],
);
export type EventTable = typeof kill;

export const EVENT_TABLES = {
  ability_1_used: ability1Used,
  ability_2_used: ability2Used,
  damage,
  defensive_assist: defensiveAssist,
  dva_remech: dvaRemech,
  echo_duplicate_end: echoDuplicateEnd,
  echo_duplicate_start: echoDuplicateStart,
  healing,
  hero_spawn: heroSpawn,
  hero_swap: heroSwap,
  kill,
  match_end: matchEnd,
  match_start: matchStart,
  mercy_rez: mercyRez,
  objective_captured: objectiveCaptured,
  objective_updated: objectiveUpdated,
  offensive_assist: offensiveAssist,
  payload_progress: payloadProgress,
  player_stat: playerStat,
  point_progress: pointProgress,
  remech_charged: remechCharged,
  round_end: roundEnd,
  round_start: roundStart,
  setup_complete: setupComplete,
  ultimate_charged: ultimateCharged,
  ultimate_end: ultimateEnd,
  ultimate_start: ultimateStart,
} satisfies Record<EventType, unknown>;
