# ow-scrims

A single-user Overwatch 2 scrim analytics app, modelled on Parsertime. Upload the per-map log files that the ScrimTime workshop code writes through the Workshop Inspector, and the app parses every event type into a local database and shows a map overview: score, winner, team damage and healing, and a per-player stat table with per-10-minute rates. Each map also has a fight-grouped killfeed with a CSV download and a line naming who engaged each fight first, an events timeline with per-ultimate conversion kills, a Charts tab (a tempo curve, an Ultimates row with advantage per fight, combos, counter-ults, and fight initiation win rates, plus kills by fight, final blows by role, and cumulative hero damage by round), a two-player comparison, a Telemetry tab (damage by opposing hero, focus fire by role, and a matchup radar, when the log was recorded with damage logging on), and, once the position features are switched on, a Heatmap tab (kills, deaths, fight centres, damage, healing, presence, movement routes, territory by side, and objective control per round, when the log was recorded with position logging on), a Replay tab, and a Maps page holding one top-down image per map stage, calibrated by pairing logged kills with clicks on the image.

A Team area aggregates every scrim in a date range: win rates by map and type, hero pick rates against recorded bans, ult economy over time, teamfight statistics with per-hero ultimate and ability impact tables, and a headline overview. It also has a Players tab with the roster and per-player pages (per-10 stats, fight and ult cards, MVP score, deadlift share, drought, play style, personal records, hero filter, per-scrim chart).

Built with Next.js (App Router, TypeScript), Drizzle ORM, and PGlite (embedded Postgres) with a swappable node-postgres driver for later deployment.

## Quick start

```bash
pnpm install
pnpm exec playwright install chromium   # once, for the browser tests
pnpm dev          # http://localhost:3000, data in ./data
pnpm test         # Vitest
pnpm test:e2e     # Playwright, builds and starts its own server on :3100 with a throwaway database
pnpm lint && pnpm typecheck
pnpm db:generate  # after editing src/lib/db/schema.ts
```

## Collecting logs

The app ingests the per-map log files written by the ScrimTime Workshop code through Overwatch's Workshop Inspector:

1. In Overwatch, enable **"Enable Workshop Inspector Log File"** in the settings.
2. Host a custom game lobby with the ScrimTime workshop code `DKEEH`.
3. In that code's Workshop settings, turn on damage, healing, ability, and position logging. The Telemetry tab and fight initiation need the damage events; the Heatmap tab and the replay need positions, and a log without positions can never be replayed; maps logged without them show a notice instead.
4. After a scrim, select all of that scrim's log files in the scrim's "Add maps" form. Files are uploaded in filename order, and the app works out which side was yours from player names it has seen before; it asks only when it cannot tell. Ignore any file under 1KB — those are stub files the Workshop writes for lobbies that never started.

Only the lobby host's game writes the log, so only that player needs Workshop Inspector Logging enabled and needs to upload the files.

Each map card on the scrim page has a hero bans editor for both teams.

## Layout

```
src/app/            Next.js pages (scrim list, scrim detail, map overview/killfeed/charts/events/compare/telemetry/heatmap/replay, team overview/trends/teamfights/players roster and player detail, maps index and stage calibration), server actions, the map upload and map image route handlers, and the killfeed CSV route
src/components/      Shared primitives: button, field/input/select, badge, card, stat, table, tabs, page header, scoreboard, dropzone, empty state, skeleton, and the SVG chart helpers
src/lib/parser/      Tokenizer, sanitizer, and descriptor-driven event coercion
src/lib/db/          Drizzle schema, PGlite/Postgres connection, queries, and map insertion
src/lib/stats/       Pure computation: fights, heroes (role map), sides, rounds, overview, killfeed, killfeed-csv, events, charts, compare, ultimates, ult-analysis, ult-impact, ability-impact, tempo, telemetry, team-rows, trends, teamfights, team-overview, roster, player, player-cards, initiation, heatmap, territory, and the replay modules (positions, calibration, stages, tracks, replay, playback)
src/lib/logs.ts       Raw log file storage under LOG_DIR
src/lib/killfeed-export.ts  Killfeed CSV response (id validation, headers)
src/lib/flags.ts      Feature flags (every position-based feature — Replay, Heatmap, Maps — is merged but switched off until a stage is calibrated)
src/lib/map-images.ts Map image type detection, file storage under MAP_IMAGE_DIR, upload and serve logic
src/lib/format.ts     Display formatting helpers
test/                Vitest specs, mirroring src/, plus sample ScrimTime logs in test/samples/
e2e/                 Playwright specs (core flow, map tabs, team tabs) and helpers; playwright.config.ts at the root
drizzle/             Generated SQL migrations
```

See `docs/DOCS.md` for implementation details.

## Configuration

- `DATABASE_URL` — unset uses a PGlite database at `data/db/`; `memory://` uses an in-memory PGlite database (used by tests); a `postgres://` or `postgresql://` URL connects via node-postgres.
- `LOG_DIR` — where raw uploaded log files are stored; defaults to `data/logs/`.
- `MAP_IMAGE_DIR` — where uploaded map images are stored; defaults to `data/map-images/`.

## Design

Dark only, in an Overwatch broadcast look. Tokens (colours, radii, type scale) live in `src/app/globals.css` under Tailwind's `@theme`; Archivo (body) and Bebas Neue (display) are self-hosted from `src/app/fonts/` (OFL). Blue is our team, red is theirs, orange is an action, green and red tints are outcomes.
