#!/bin/sh
set -eu
: "${RESTORE_DATABASE_URL:?Set a new disposable restore database URL}"
[ "${IEUM_RESTORE_DISPOSABLE:-}" = true ] || { echo 'Set IEUM_RESTORE_DISPOSABLE=true for a new empty restore database' >&2; exit 1; }
[ "$#" -eq 1 ] || { echo 'Usage: restore.sh database.dump' >&2; exit 1; }
RESTORE_TABLES=$(psql "$RESTORE_DATABASE_URL" -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p')")
[ "$RESTORE_TABLES" = 0 ] || { echo 'Restore destination is not empty' >&2; exit 1; }
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$1"
printf 'Restore complete; verify active batch and separately restore permitted raw artifacts\n'
