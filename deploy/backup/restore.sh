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

UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"
: "${BACKUP_REMOTE:?set BACKUP_REMOTE}"

if [ "${1:-}" = "list" ]; then
  rclone lsf "$BACKUP_REMOTE" --dirs-only | sort
  exit 0
fi

: "${DATABASE_URL:?set DATABASE_URL}"
: "${BACKUP_AGE_IDENTITY:?set BACKUP_AGE_IDENTITY (path to the age private key)}"

stamp="${1:?usage: restore.sh list|latest|<stamp>}"

if [ "$stamp" = "latest" ]; then
  stamp="$(rclone lsf "$BACKUP_REMOTE" --dirs-only | sort | tail -n 1 | tr -d /)"
fi

work="$(mktemp -d)"
started="$(date +%s)"

rclone copy "$BACKUP_REMOTE/$stamp" "$work" --quiet

age -d -i "$BACKUP_AGE_IDENTITY" "$work"/db-*.dump.age \
  | pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL"

if ls "$work"/uploads-*.tgz.age >/dev/null 2>&1; then
  mkdir -p "$UPLOADS_DIR"
  age -d -i "$BACKUP_AGE_IDENTITY" "$work"/uploads-*.tgz.age \
    | tar -C "$UPLOADS_DIR" -xzf -
fi

rm -rf "$work"
echo "restore: $stamp done in $(( $(date +%s) - started ))s"
