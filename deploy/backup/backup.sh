#!/bin/sh
# Backs up the database and the uploaded files, encrypted with age, to an
# off-machine rclone remote. Keeps BACKUP_KEEP_DAYS of history there.
#
#   backup.sh once       one backup now (also run before every update)
#   backup.sh schedule   one backup a day at BACKUP_AT (UTC, HHMM)
#
# Needs: DATABASE_URL, BACKUP_AGE_RECIPIENT (an age public key),
# BACKUP_REMOTE (an rclone path such as "b2:my-bucket/zentro", configured
# with RCLONE_CONFIG_* variables). Optional: ALERT_WEBHOOK_URL, BACKUP_AT
# (default 0230), BACKUP_KEEP_DAYS (default 14), UPLOADS_DIR (default
# /data/uploads).
set -eu
set -o pipefail

UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
AT="${BACKUP_AT:-0230}"

alert() {
  echo "backup: $1" >&2
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -fsS -m 20 -H "Content-Type: application/json" \
      -d "{\"text\":\"Zentro backup: $1\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true
  fi
}

run_once() (
  : "${DATABASE_URL:?set DATABASE_URL}"
  : "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT (an age public key)}"
  : "${BACKUP_REMOTE:?set BACKUP_REMOTE (an rclone path)}"

  work="$(mktemp -d)" || return 1
  trap 'rm -rf "$work"' EXIT
  stamp="$(date -u +%Y-%m-%dT%H%M%SZ)-${work##*.}"
  started="$(date +%s)"

  # The dump goes straight into age: the plain database never touches disk.
  pg_dump --format=custom --no-owner "$DATABASE_URL" \
    | age -r "$BACKUP_AGE_RECIPIENT" >"$work/db-$stamp.dump.age" || return 1

  if [ -d "$UPLOADS_DIR" ]; then
    tar -C "$UPLOADS_DIR" -czf - . \
      | age -r "$BACKUP_AGE_RECIPIENT" >"$work/uploads-$stamp.tgz.age" || return 1
  fi

  rclone copy "$work" "$BACKUP_REMOTE/$stamp" --quiet || return 1
  # Publish completion only after both encrypted archives reach the remote.
  touch "$work/complete" || return 1
  rclone copyto "$work/complete" "$BACKUP_REMOTE/$stamp/complete" --quiet || return 1
  rclone delete "$BACKUP_REMOTE" --min-age "${KEEP}d" --quiet || true
  rclone rmdirs "$BACKUP_REMOTE" --leave-root --quiet || true

  size="$(du -sh "$work" | cut -f1)"
  echo "backup: $stamp done in $(( $(date +%s) - started ))s ($size)"
)

case "${1:-once}" in
  once)
    run_once || { alert "failed at $(date -u)"; exit 1; }
    ;;
  schedule)
    while true; do
      if [ "$(date -u +%H%M)" = "$AT" ]; then
        run_once || alert "failed at $(date -u)"
        sleep 61
      fi
      sleep 30
    done
    ;;
  *)
    echo "usage: backup.sh once|schedule" >&2
    exit 2
    ;;
esac
