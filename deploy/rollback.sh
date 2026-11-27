#!/bin/sh
# Goes back to the image that ran before the last update.
#   deploy/rollback.sh              the app only (the database stays as it is)
#   deploy/rollback.sh --restore    also restore the backup taken before the
#                                   update (only if a migration broke the data;
#                                   anything written since that backup is lost)
set -eu

compose="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"
profile="${KYREN_PROFILE---profile db}"
if [ -f deploy/.rollback-point ]; then
  previous="$(sed -n '1p' deploy/.rollback-point)"
  stamp="$(sed -n '2p' deploy/.rollback-point)"
else
  previous="$(cat deploy/.previous-version 2>/dev/null || true)"
  stamp=""
fi

if [ -z "$previous" ]; then
  echo "No previous version recorded (deploy/.previous-version)." >&2
  exit 1
fi

if [ "${1:-}" = "--restore" ]; then
  : "${BACKUP_AGE_IDENTITY_FILE:?set BACKUP_AGE_IDENTITY_FILE to the age private key file}"
  [ -n "$stamp" ] || {
    echo "Missing pre-update backup record. Verify the restore point before restoring." >&2
    exit 1
  }
  $compose $profile stop web cron
  $compose $profile run --rm \
    -v "$BACKUP_AGE_IDENTITY_FILE:/run/age.key:ro" \
    -e BACKUP_AGE_IDENTITY=/run/age.key \
    backup restore.sh "$stamp"
fi

echo "== starting $previous"
KYREN_VERSION="$previous" $compose $profile up -d --no-build web cron
echo "$previous" >deploy/.version
echo "== rolled back to $previous"
