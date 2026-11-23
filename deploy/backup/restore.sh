#!/bin/sh
# Restores a backup made by backup.sh into DATABASE_URL and UPLOADS_DIR.
#
#   restore.sh list            the backups on the remote, newest last
#   restore.sh <stamp>         restore that backup (e.g. 2026-11-20T0230Z)
#   restore.sh latest          restore the newest one
#
# Needs: DATABASE_URL, BACKUP_REMOTE, BACKUP_AGE_IDENTITY (path to the age
# private key file, kept off this machine and mounted only for a restore).
# The database is replaced: run it against an empty database, or one you
# mean to overwrite.
set -eu
set -o pipefail

UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"
: "${BACKUP_REMOTE:?set BACKUP_REMOTE}"

list_backups() {
  # Older backups used minute timestamps and predate completion markers.
  rclone lsf "$BACKUP_REMOTE" --recursive --files-only --max-depth 2 |
    awk -F/ 'NF == 2 && ($2 == "complete" || ($1 ~ /^[0-9-]+T[0-9]+Z$/ && $2 == "db-" $1 ".dump.age")) {print $1 "/"}' |
    sort -u
}

if [ "${1:-}" = "list" ]; then
  list_backups
  exit $?
fi

: "${DATABASE_URL:?set DATABASE_URL}"
: "${BACKUP_AGE_IDENTITY:?set BACKUP_AGE_IDENTITY (path to the age private key)}"

stamp="${1:?usage: restore.sh list|latest|<stamp>}"

if [ "$stamp" = "latest" ]; then
  stamp="$(list_backups | tail -n 1 | tr -d /)"
  [ -n "$stamp" ] || { echo "restore: no backups found" >&2; exit 1; }
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
started="$(date +%s)"

rclone copy "$BACKUP_REMOTE/$stamp" "$work" --quiet

case "$stamp" in
  *Z-*) [ -f "$work/complete" ] || { echo "restore: incomplete backup" >&2; exit 1; } ;;
esac

age -d -i "$BACKUP_AGE_IDENTITY" "$work"/db-*.dump.age \
  | pg_restore --single-transaction --clean --if-exists --no-owner --dbname "$DATABASE_URL"

if ls "$work"/uploads-*.tgz.age >/dev/null 2>&1; then
  mkdir -p "$UPLOADS_DIR"
  age -d -i "$BACKUP_AGE_IDENTITY" "$work"/uploads-*.tgz.age \
    | tar -C "$UPLOADS_DIR" -xzf -
fi

echo "restore: $stamp done in $(( $(date +%s) - started ))s"
