# OW Scrims

A single-user Overwatch 2 scrim analytics app. Upload the per-map log files that the ScrimTime Workshop code writes, and it parses every event into a local database: per-map breakdowns of a scrim, and team, player, and hero trends across every scrim in a date range. Built with Next.js, Drizzle ORM, and PGlite (embedded Postgres), so it runs on one machine with no services to set up.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000, data in ./data
```

Create a scrim, drop its log files onto the scrim page, and open the map and Team tabs. `pnpm test`, `pnpm test:e2e`, `pnpm lint`, and `pnpm typecheck` are the checks; GitHub Actions runs them on every push and pull request. Implementation details are in `docs/DOCS.md`.

A public copy runs at scrims.hnguyentran.com with pseudonymised names; every visitor gets a throwaway sandbox on their first change. Deployment and the snapshot push are described in `docs/DOCS.md`.

## Collecting logs

The app ingests the per-map log files that the ScrimTime Workshop code writes through Overwatch's Workshop Inspector:

1. In Overwatch, enable **"Enable Workshop Inspector Log File"** in the settings.
2. Host a custom game lobby with the ScrimTime workshop code `DKEEH`.
3. In that code's Workshop settings, turn on damage, healing, ability, and position logging. Fight initiation and the Telemetry tab need the damage events; maps logged without them show a notice instead.
4. After the scrim, select all of its log files in the scrim page's "Add maps" form. Files upload in filename order, and the app works out which side was yours from player names it has seen before, asking only when it cannot tell. Skip any file under 1 KB; those are stubs the Workshop writes for lobbies that never started.

Only the lobby host's game writes the log, so only that player needs the setting on and needs to upload the files.

## Highlights

**Per map**
- Scoreboard with the winner, team damage and healing, and a per-player table of per-10-minute rates. A Push map gets its winner by hand, which writes the score.
- A fight-grouped killfeed naming who engaged each fight first, with a CSV download.
- Charts: a tempo curve, ult advantage per fight, combos and counter-ults, initiation win rates, final blows by fight and by role, and hero damage by round.
- An events timeline, a two-player comparison, and a Telemetry tab with damage by opposing hero, focus fire by role, and a matchup radar measured against the enemy in the same role.

**Across scrims**
- Team overview: record, strongest and blind-spot maps and modes, role balance, and per-role performance cards.
- Trends: win rates by map and type, a map gallery, hero picks against recorded bans, a hero-picks-by-scrim heatmap, and ult economy over time.
- Teamfights: fight, first-pick, first-death, and first-ult win rates; win rate when engaging first or when engaged; per-hero ultimate and ability impact.
- Charts: scatter plots of per-10 stats per player, hero, and map, with presets, a custom pair, a hero filter, role and player toggles, and a trend line.
- Players: the roster, a player-by-map record matrix, and per-player pages with per-10 stats, fight and ult cards, MVP score, deadlift share, drought, play style, personal records, a hero filter, and a per-scrim chart.
