-- Map names the Workshop wrote in capitals are now stored title-cased, e.g. "NEON JUNCTION" -> "Neon Junction".
UPDATE "map" SET "map_name" = initcap(lower("map_name")) WHERE "map_name" = upper("map_name") AND "map_name" ~ '[[:alpha:]]';
