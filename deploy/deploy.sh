#!/usr/bin/env bash
# deploy/deploy.sh — build locally, sync the standalone output to the box, restart.
# Needs an ssh host alias "ow-scrims" (user ubuntu, the Lightsail key) in ~/.ssh/config.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${OW_SSH_HOST:-ow-scrims}"

# DATABASE_URL=memory:// so nothing the build evaluates can open data/db.
DATABASE_URL=memory:// BUILD_STANDALONE=1 pnpm build
[[ -f .next/standalone/server.js ]] || { echo "no standalone output; is BUILD_STANDALONE honoured in next.config.ts?"; exit 1; }

# Belt and suspenders: the trace is scoped by outputFileTracingExcludes in next.config.ts, but refuse
# outright if real data, the snapshot pipeline's state, or the specs and fixtures that quote real
# names ever end up in the standalone output anyway.
for p in data .snapshot .push-state.json "data/alias-map.json" test docs e2e .superpowers .claude; do
  [[ -e ".next/standalone/$p" ]] && { echo "refusing to deploy: .next/standalone/$p exists; check outputFileTracingExcludes"; exit 1; }
done

# ProtectSystem=strict makes /opt read-only except for ReadWritePaths, and the unit lists
# .next/cache; it must exist or systemd fails the mount namespace.
mkdir -p .next/standalone/.next/cache

rsync -a --delete "./.next/static/" "./.next/standalone/.next/static/"
rsync -a --delete "./public/" "./.next/standalone/public/"
rsync -a --delete "./drizzle/" "./.next/standalone/drizzle/"
rsync -a --delete "./deploy/" "./.next/standalone/deploy/"

rsync -az --delete \
  --exclude /data --exclude /.snapshot --exclude /.push-state.json --exclude '/data/alias-map.json' \
  --exclude /test --exclude /docs --exclude /e2e --exclude /.superpowers --exclude /.claude \
  --rsync-path="sudo -u owscrims rsync" "./.next/standalone/" "$HOST:/opt/ow-scrims/"
ssh "$HOST" sudo systemctl restart ow-scrims
# instrumentation.ts sweeps every orphaned sandbox database before the server answers, so
# readiness is not instant after a restart; poll instead of sleeping a fixed two seconds.
ssh "$HOST" 'systemctl is-active ow-scrims || exit 1
for i in $(seq 1 30); do
  curl -fsS -o /dev/null -w "app answered %{http_code}\n" http://127.0.0.1:3000/ && exit 0
  sleep 2
done
echo "app did not answer within 60s" >&2; exit 1'

# Schema changes need a fresh snapshot: the sandboxes copy the template's schema, not the code's.
current="$(find drizzle -type f | sort | xargs shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
pushed="$(node -e 'try{console.log(require("./.push-state.json").drizzleHash)}catch{console.log("")}')"
if [[ "$current" != "$pushed" ]]; then
  echo "drizzle/ changed since the last snapshot push (or none recorded): run pnpm push-snapshot"
fi
