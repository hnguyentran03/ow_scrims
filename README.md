# ow-scrims

A single-user Overwatch 2 scrim analytics app, modelled on Parsertime. Upload the per-map log files that the ScrimTime workshop code writes through the Workshop Inspector, and the app parses every event type into a local database and shows a map overview: score, winner, team damage and healing, and a per-player stat table with per-10-minute rates.

Planned stack: Next.js with TypeScript, SQLite locally with a swappable Postgres driver for later deployment. No code exists yet; the design is being finalised in `docs/superpowers/specs/`.

