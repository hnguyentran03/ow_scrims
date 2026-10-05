#!/usr/bin/env bash
# deploy/deploy.sh — build locally, sync the standalone output to the box, restart.
# Needs an ssh host alias "ow-scrims" (user ubuntu, the Lightsail key) in ~/.ssh/config.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${OW_SSH_HOST:-ow-scrims}"

BUILD_STANDALONE=1 pnpm build
[[ -f .next/standalone/server.js ]] || { echo "no standalone output; is BUILD_STANDALONE honoured in next.config.ts?"; exit 1; }

# Belt and suspenders: the trace is scoped by outputFileTracingExcludes in next.config.ts, but refuse
# outright if real data or the snapshot pipeline's state ever end up in the standalone output anyway.
for p in data .snapshot .push-state.json "data/alias-map.json"; do
  [[ -e ".next/standalone/$p" ]] && { echo "refusing to deploy: .next/standalone/$p exists; check outputFileTracingExcludes"; exit 1; }
done

rsync -a --delete "./.next/static/" "./.next/standalone/.next/static/"
rsync -a --delete "./public/" "./.next/standalone/public/"
rsync -a --delete "./drizzle/" "./.next/standalone/drizzle/"
rsync -a --delete "./deploy/" "./.next/standalone/deploy/"

rsync -az --delete --exclude data --exclude .snapshot --exclude .push-state.json --exclude 'alias-map.json' --rsync-path="sudo -u owscrims rsync" "./.next/standalone/" "$HOST:/opt/ow-scrims/"
ssh "$HOST" sudo systemctl restart ow-scrims
ssh "$HOST" 'sleep 2; systemctl is-active ow-scrims && curl -fsS -o /dev/null -w "app answered %{http_code}\n" http://127.0.0.1:3000/'

# Schema changes need a fresh snapshot: the sandboxes copy the template's schema, not the code's.
current="$(find drizzle -type f | sort | xargs shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
pushed="$(node -e 'try{console.log(require("./.push-state.json").drizzleHash)}catch{console.log("")}')"
if [[ "$current" != "$pushed" ]]; then
  echo "drizzle/ changed since the last snapshot push (or none recorded): run pnpm push-snapshot"
fi
