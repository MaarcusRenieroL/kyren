#!/bin/sh
# Updates Kyren on this VM: a backup first, then a new tagged image,
# migrations and a restart. The previous version is remembered for rollback.
#   deploy/update.sh            (run from the repository root)
set -eu

compose="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"
profile="${KYREN_PROFILE---profile db}"

previous="$(cat deploy/.version 2>/dev/null || echo latest)"

echo "== backup before updating"
backup_log="$(mktemp)"
trap 'rm -f "$backup_log"' EXIT
$compose $profile run --rm -T backup backup.sh once >"$backup_log"
cat "$backup_log"
stamp="$(sed -n 's/^backup: \([^ ]*\) done in .*/\1/p' "$backup_log")"
[ -n "$stamp" ] || { echo "Could not identify the pre-update backup." >&2; exit 1; }

echo "== new code"
git pull --ff-only
version="$(git rev-parse --short HEAD)"

echo "== build and start $version (was $previous)"
# Record the restore point before migrations can change the database.
printf '%s\n%s\n' "$previous" "$stamp" >deploy/.rollback-point.tmp
mv deploy/.rollback-point.tmp deploy/.rollback-point
KYREN_VERSION="$version" $compose $profile up -d --build --wait

echo "$version" >deploy/.version
echo "== done. Roll back with: deploy/rollback.sh"
