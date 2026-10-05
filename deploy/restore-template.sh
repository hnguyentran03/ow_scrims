#!/usr/bin/env bash
# deploy/restore-template.sh <snapshot.sql.gz>
# Runs on the box as the owscrims role. Restores into a new database, swaps it in as
# the template, and rebuilds the public read copy. Existing sandboxes keep their data
# until they expire or are reset.
set -euo pipefail
DUMP="${1:?usage: restore-template.sh <snapshot.sql.gz>}"
TEMPLATE="${SANDBOX_TEMPLATE_DB:-ow_template}"
PUBLIC="${SANDBOX_PUBLIC_DB:-ow_public}"

[[ "$TEMPLATE" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "invalid SANDBOX_TEMPLATE_DB" >&2; exit 1; }
[[ "$PUBLIC" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "invalid SANDBOX_PUBLIC_DB" >&2; exit 1; }

psql -q -d postgres -c "DROP DATABASE IF EXISTS \"${TEMPLATE}_new\" WITH (FORCE)"
createdb "${TEMPLATE}_new"
gunzip -c "$DUMP" | psql -v ON_ERROR_STOP=1 -q -d "${TEMPLATE}_new"

psql -q -d postgres -c "DROP DATABASE IF EXISTS \"${TEMPLATE}_old\" WITH (FORCE)"
psql -q -d postgres -c "ALTER DATABASE \"${TEMPLATE}\" RENAME TO \"${TEMPLATE}_old\"" 2>/dev/null || true   # absent on the first push
if ! psql -q -d postgres -c "ALTER DATABASE \"${TEMPLATE}_new\" RENAME TO \"${TEMPLATE}\""; then
  echo "promotion failed; restoring the previous template" >&2
  psql -q -d postgres -c "ALTER DATABASE \"${TEMPLATE}_old\" RENAME TO \"${TEMPLATE}\"" || true
  exit 1
fi
psql -q -d postgres -c "DROP DATABASE IF EXISTS \"${TEMPLATE}_old\" WITH (FORCE)"

# The public copy has live connections from the app; FORCE closes them and the pool reconnects.
psql -q -d postgres -c "DROP DATABASE IF EXISTS \"${PUBLIC}\" WITH (FORCE)"
psql -q -d postgres -c "CREATE DATABASE \"${PUBLIC}\" TEMPLATE \"${TEMPLATE}\" STRATEGY = FILE_COPY"
rm -f "$DUMP"
echo "template and public copy replaced"
