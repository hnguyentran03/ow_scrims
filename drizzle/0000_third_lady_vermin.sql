CREATE TABLE "ability_1_used" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"hero_duplicated" text NOT NULL,
	"player_position" text
);
--> statement-breakpoint
CREATE TABLE "ability_2_used" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"hero_duplicated" text NOT NULL,
	"player_position" text
);
--> statement-breakpoint
CREATE TABLE "damage" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"attacker_team" text NOT NULL,
	"attacker_name" text NOT NULL,
	"attacker_hero" text NOT NULL,
	"victim_team" text NOT NULL,
	"victim_name" text NOT NULL,
	"victim_hero" text NOT NULL,
	"event_ability" text NOT NULL,
	"event_damage" double precision NOT NULL,
	"is_critical_hit" text NOT NULL,
	"is_environmental" text NOT NULL,
	"attacker_position" text,
	"victim_position" text
);
--> statement-breakpoint
CREATE TABLE "defensive_assist" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"hero_duplicated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dva_remech" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"ultimate_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "echo_duplicate_end" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"ultimate_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "echo_duplicate_start" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"hero_duplicated" text NOT NULL,
	"ultimate_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healing" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"healer_team" text NOT NULL,
	"healer_name" text NOT NULL,
	"healer_hero" text NOT NULL,
	"healee_team" text NOT NULL,
	"healee_name" text NOT NULL,
	"healee_hero" text NOT NULL,
	"event_ability" text NOT NULL,
	"event_healing" double precision NOT NULL,
	"is_health_pack" text NOT NULL,
	"healer_position" text,
	"healee_position" text
);
--> statement-breakpoint
CREATE TABLE "hero_spawn" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"previous_hero" integer,
	"hero_time_played" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hero_swap" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"previous_hero" text NOT NULL,
	"hero_time_played" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kill" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"attacker_team" text NOT NULL,
	"attacker_name" text NOT NULL,
	"attacker_hero" text NOT NULL,
	"victim_team" text NOT NULL,
	"victim_name" text NOT NULL,
	"victim_hero" text NOT NULL,
	"event_ability" text NOT NULL,
	"event_damage" double precision NOT NULL,
	"is_critical_hit" text NOT NULL,
	"is_environmental" text NOT NULL,
	"assist_count" text,
	"attacker_position" text,
	"victim_position" text
);
--> statement-breakpoint
CREATE TABLE "map" (
	"id" serial PRIMARY KEY NOT NULL,
	"scrim_id" integer NOT NULL,
	"map_order" integer NOT NULL,
	"map_name" text NOT NULL,
	"map_type" text NOT NULL,
	"team1_name" text NOT NULL,
	"team2_name" text NOT NULL,
	"our_side" integer NOT NULL,
	"winner_side" integer,
	"winner_source" text,
	"team1_score" integer NOT NULL,
	"team2_score" integer NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"round_count" integer NOT NULL,
	"raw_log_path" text,
	"original_filename" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_end" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"team_1_score" integer NOT NULL,
	"team_2_score" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_start" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"map_name" text NOT NULL,
	"map_type" text NOT NULL,
	"team_1_name" text NOT NULL,
	"team_2_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mercy_rez" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"resurrecter_team" text NOT NULL,
	"resurrecter_player" text NOT NULL,
	"resurrecter_hero" text NOT NULL,
	"resurrectee_team" text NOT NULL,
	"resurrectee_player" text NOT NULL,
	"resurrectee_hero" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objective_captured" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"capturing_team" text NOT NULL,
	"objective_index" integer NOT NULL,
	"control_team_1_progress" double precision NOT NULL,
	"control_team_2_progress" double precision NOT NULL,
	"match_time_remaining" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objective_updated" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"previous_objective_index" integer NOT NULL,
	"current_objective_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offensive_assist" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"hero_duplicated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payload_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"capturing_team" text NOT NULL,
	"objective_index" integer NOT NULL,
	"payload_capture_progress" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stat" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"eliminations" integer NOT NULL,
	"final_blows" integer NOT NULL,
	"deaths" integer NOT NULL,
	"all_damage_dealt" double precision NOT NULL,
	"barrier_damage_dealt" double precision NOT NULL,
	"hero_damage_dealt" double precision NOT NULL,
	"healing_dealt" double precision NOT NULL,
	"healing_received" double precision NOT NULL,
	"self_healing" double precision NOT NULL,
	"damage_taken" double precision NOT NULL,
	"damage_blocked" double precision NOT NULL,
	"defensive_assists" integer NOT NULL,
	"offensive_assists" integer NOT NULL,
	"ultimates_earned" integer NOT NULL,
	"ultimates_used" integer NOT NULL,
	"multikill_best" integer NOT NULL,
	"multikills" integer NOT NULL,
	"solo_kills" integer NOT NULL,
	"objective_kills" integer NOT NULL,
	"environmental_kills" integer NOT NULL,
	"environmental_deaths" integer NOT NULL,
	"critical_hits" integer NOT NULL,
	"critical_hit_accuracy" double precision NOT NULL,
	"scoped_accuracy" double precision NOT NULL,
	"scoped_critical_hit_accuracy" double precision NOT NULL,
	"scoped_critical_hit_kills" integer NOT NULL,
	"shots_fired" integer NOT NULL,
	"shots_hit" integer NOT NULL,
	"shots_missed" integer NOT NULL,
	"scoped_shots_fired" integer NOT NULL,
	"scoped_shots_hit" integer NOT NULL,
	"weapon_accuracy" double precision NOT NULL,
	"hero_time_played" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"capturing_team" text NOT NULL,
	"objective_index" integer NOT NULL,
	"point_capture_progress" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remech_charged" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"hero_duplicated" text NOT NULL,
	"ultimate_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_end" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"capturing_team" text NOT NULL,
	"team_1_score" integer NOT NULL,
	"team_2_score" integer NOT NULL,
	"objective_index" integer NOT NULL,
	"control_team_1_progress" double precision NOT NULL,
	"control_team_2_progress" double precision NOT NULL,
	"match_time_remaining" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_start" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"capturing_team" text NOT NULL,
	"team_1_score" integer NOT NULL,
	"team_2_score" integer NOT NULL,
	"objective_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrim" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"opponent_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup_complete" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"round_number" integer NOT NULL,
	"match_time_remaining" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ultimate_charged" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"hero_duplicated" text NOT NULL,
	"ultimate_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ultimate_end" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text,
	"hero_duplicated" text NOT NULL,
	"ultimate_id" integer NOT NULL,
	"player_position" text
);
--> statement-breakpoint
CREATE TABLE "ultimate_start" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"match_time" double precision NOT NULL,
	"player_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_hero" text NOT NULL,
	"hero_duplicated" text NOT NULL,
	"ultimate_id" integer NOT NULL,
	"player_position" text
);
--> statement-breakpoint
ALTER TABLE "ability_1_used" ADD CONSTRAINT "ability_1_used_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ability_2_used" ADD CONSTRAINT "ability_2_used_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage" ADD CONSTRAINT "damage_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defensive_assist" ADD CONSTRAINT "defensive_assist_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dva_remech" ADD CONSTRAINT "dva_remech_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echo_duplicate_end" ADD CONSTRAINT "echo_duplicate_end_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echo_duplicate_start" ADD CONSTRAINT "echo_duplicate_start_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "healing" ADD CONSTRAINT "healing_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_spawn" ADD CONSTRAINT "hero_spawn_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_swap" ADD CONSTRAINT "hero_swap_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kill" ADD CONSTRAINT "kill_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map" ADD CONSTRAINT "map_scrim_id_scrim_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_end" ADD CONSTRAINT "match_end_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_start" ADD CONSTRAINT "match_start_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercy_rez" ADD CONSTRAINT "mercy_rez_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_captured" ADD CONSTRAINT "objective_captured_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_updated" ADD CONSTRAINT "objective_updated_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offensive_assist" ADD CONSTRAINT "offensive_assist_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payload_progress" ADD CONSTRAINT "payload_progress_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stat" ADD CONSTRAINT "player_stat_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_progress" ADD CONSTRAINT "point_progress_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remech_charged" ADD CONSTRAINT "remech_charged_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_end" ADD CONSTRAINT "round_end_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_start" ADD CONSTRAINT "round_start_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_complete" ADD CONSTRAINT "setup_complete_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ultimate_charged" ADD CONSTRAINT "ultimate_charged_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ultimate_end" ADD CONSTRAINT "ultimate_end_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ultimate_start" ADD CONSTRAINT "ultimate_start_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ability_1_used_map_id_idx" ON "ability_1_used" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "ability_2_used_map_id_idx" ON "ability_2_used" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "damage_map_id_idx" ON "damage" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "defensive_assist_map_id_idx" ON "defensive_assist" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "dva_remech_map_id_idx" ON "dva_remech" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "echo_duplicate_end_map_id_idx" ON "echo_duplicate_end" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "echo_duplicate_start_map_id_idx" ON "echo_duplicate_start" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "healing_map_id_idx" ON "healing" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "hero_spawn_map_id_idx" ON "hero_spawn" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "hero_swap_map_id_idx" ON "hero_swap" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "kill_map_id_idx" ON "kill" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "map_scrim_id_idx" ON "map" USING btree ("scrim_id");--> statement-breakpoint
CREATE INDEX "match_end_map_id_idx" ON "match_end" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "match_start_map_id_idx" ON "match_start" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "mercy_rez_map_id_idx" ON "mercy_rez" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "objective_captured_map_id_idx" ON "objective_captured" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "objective_updated_map_id_idx" ON "objective_updated" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "offensive_assist_map_id_idx" ON "offensive_assist" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "payload_progress_map_id_idx" ON "payload_progress" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "player_stat_map_id_idx" ON "player_stat" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "player_stat_map_round_idx" ON "player_stat" USING btree ("map_id","round_number");--> statement-breakpoint
CREATE INDEX "point_progress_map_id_idx" ON "point_progress" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "remech_charged_map_id_idx" ON "remech_charged" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "round_end_map_id_idx" ON "round_end" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "round_start_map_id_idx" ON "round_start" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "setup_complete_map_id_idx" ON "setup_complete" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "ultimate_charged_map_id_idx" ON "ultimate_charged" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "ultimate_end_map_id_idx" ON "ultimate_end" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "ultimate_start_map_id_idx" ON "ultimate_start" USING btree ("map_id");