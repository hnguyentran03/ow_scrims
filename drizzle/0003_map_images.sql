CREATE TABLE "map_image" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_name" text NOT NULL,
	"stage" integer NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"calibration" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "map_image_map_stage" UNIQUE("map_name","stage")
);
