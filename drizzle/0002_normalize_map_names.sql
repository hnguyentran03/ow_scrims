-- Map names are now stored without a trailing seasonal variant, e.g. "Lijiang Tower (Lunar New Year)" -> "Lijiang Tower".
UPDATE "map" SET "map_name" = btrim(regexp_replace("map_name", '\s*\([^)]*\)\s*$', '')) WHERE "map_name" ~ '\([^)]*\)\s*$';
