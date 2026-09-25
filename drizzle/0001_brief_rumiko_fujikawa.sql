CREATE TABLE "map_ban" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"side" integer NOT NULL,
	"hero" text NOT NULL,
	CONSTRAINT "map_ban_map_side_hero" UNIQUE("map_id","side","hero")
);
--> statement-breakpoint
ALTER TABLE "map_ban" ADD CONSTRAINT "map_ban_map_id_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "map_ban_map_id_idx" ON "map_ban" USING btree ("map_id");