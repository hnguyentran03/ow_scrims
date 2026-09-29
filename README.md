# ow-scrims

A single-user Overwatch 2 scrim analytics app, modelled on Parsertime. Upload the per-map log files that the ScrimTime workshop code writes through the Workshop Inspector, and the app parses every event type into a local database and shows a map overview: score, winner, team damage and healing, and a per-player stat table with per-10-minute rates. Each map also has a fight-grouped killfeed with a CSV download and a line naming who engaged each fight first, an events timeline with per-ultimate conversion kills, a Charts tab (a tempo curve, an Ultimates row with advantage per fight, combos, counter-ults, and fight initiation win rates, plus kills by fight, final blows by role, and cumulative hero damage by round), a two-player comparison, a Telemetry tab (damage by opposing hero, focus fire by role, and a matchup radar, when the log was recorded with damage logging on), and a Heatmap tab (kills, deaths, fight centres, damage, healing, presence, movement routes, and territory by side per round, when the log was recorded with position logging on; drawn on a plane fitted to each round until map images land).

A Team area aggregates every scrim in a date range: win rates by map and type, hero pick rates against recorded bans, ult economy over time, teamfight statistics, and a headline overview. It also has a Players tab with the roster and per-player pages (per-10 stats, fight and ult cards, hero filter, per-scrim chart).

Built with Next.js (App Router, TypeScript), Drizzle ORM, and PGlite (embedded Postgres) with a swappable node-postgres driver for later deployment.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000, data in ./data
pnpm test         # Vitest
pnpm lint && pnpm typecheck
pnpm db:generate  # after editing src/lib/db/schema.ts
```

## Collecting logs

The app ingests the per-map log files written by the ScrimTime Workshop code through Overwatch's Workshop Inspector:

1. In Overwatch, enable **"Enable Workshop Inspector Log File"** in the settings.
2. Host a custom game lobby with the ScrimTime workshop code `DKEEH`.
3. In that code's Workshop settings, turn on damage, healing, ability, and position logging. The Telemetry tab and fight initiation need the damage events; the Heatmap tab needs positions; maps logged without them show a notice instead.
4. After a scrim, select all of that scrim's log files in the scrim's "Add maps" form. Files are uploaded in filename order, and the app works out which side was yours from player names it has seen before; it asks only when it cannot tell. Ignore any file under 1KB — those are stub files the Workshop writes for lobbies that never started.

Only the lobby host's game writes the log, so only that player needs Workshop Inspector Logging enabled and needs to upload the files.

Each map card on the scrim page has a hero bans editor for both teams.

## Layout

```
src/app/            Next.js pages (scrim list, scrim detail, map overview/killfeed/charts/events/compare/telemetry/heatmap, team overview/trends/teamfights/players roster and player detail), server actions, the map upload route handler, and the killfeed CSV route
src/components/      Shared tab nav, card, stat cell, and SVG chart helpers
src/lib/parser/      Tokenizer, sanitizer, and descriptor-driven event coercion
src/lib/db/          Drizzle schema, PGlite/Postgres connection, queries, and map insertion
src/lib/stats/       Pure computation: fights, heroes (role map), sides, rounds, overview, killfeed, killfeed-csv, events, charts, compare, ultimates, ult-analysis, tempo, telemetry, team-rows, trends, teamfights, team-overview, roster, player, initiation, heatmap, territory, and the replay modules (positions, calibration, stages, tracks, replay, playback)
src/lib/logs.ts       Raw log file storage under LOG_DIR
src/lib/killfeed-export.ts  Killfeed CSV response (id validation, headers)
src/lib/flags.ts      Feature flags (the map replay tab is merged but switched off until map images land)
src/lib/format.ts     Display formatting helpers
test/                Vitest specs, mirroring src/, plus sample ScrimTime logs in test/samples/
drizzle/             Generated SQL migrations
```

See `docs/DOCS.md` for implementation details.

## Configuration

- `DATABASE_URL` — unset uses a PGlite database at `data/db/`; `memory://` uses an in-memory PGlite database (used by tests); a `postgres://` or `postgresql://` URL connects via node-postgres.
- `LOG_DIR` — where raw uploaded log files are stored; defaults to `data/logs/`.
