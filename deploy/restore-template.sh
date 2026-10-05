#!/usr/bin/env bash
# deploy/restore-template.sh <snapshot.sql.gz>
# Runs on the box as the owscrims role. Restores into a new database, swaps it in as
# the template, and rebuilds the public read copy. Existing sandboxes keep their data
# until they expire or are reset.
set -euo pipefail
DUMP="${1:?usage: restore-template.sh <snapshot.sql.gz>}"
TEMPLATE="${SANDBOX_TEMPLATE_DB:-ow_template}"
PUBLIC="${SANDBOX_PUBLIC_DB:-ow_public}"

psql -q -d postgres -c "DROP DATABASE IF EXISTS ${TEMPLATE}_new WITH (FORCE)"
createdb "${TEMPLATE}_new"
gunzip -c "$DUMP" | psql -v ON_ERROR_STOP=1 -q -d "${TEMPLATE}_new"

psql -q -d postgres -c "DROP DATABASE IF EXISTS ${TEMPLATE}_old WITH (FORCE)"
psql -q -d postgres -c "ALTER DATABASE ${TEMPLATE} RENAME TO ${TEMPLATE}_old" 2>/dev/null || true   # absent on the first push
psql -q -d postgres -c "ALTER DATABASE ${TEMPLATE}_new RENAME TO ${TEMPLATE}"
psql -q -d postgres -c "DROP DATABASE IF EXISTS ${TEMPLATE}_old WITH (FORCE)"

# The public copy has live connections from the app; FORCE closes them and the pool reconnects.
psql -q -d postgres -c "DROP DATABASE IF EXISTS ${PUBLIC} WITH (FORCE)"
psql -q -d postgres -c "CREATE DATABASE ${PUBLIC} TEMPLATE ${TEMPLATE} STRATEGY = FILE_COPY"
rm -f "$DUMP"
echo "template and public copy replaced"
