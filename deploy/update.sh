#!/bin/sh
# Updates Zentro on this VM: a backup first, then a new tagged image,
# migrations and a restart. The previous version is remembered for rollback.
#   deploy/update.sh            (run from the repository root)
set -eu

compose="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"
profile="${ZENTRO_PROFILE:---profile db}"

previous="$(cat deploy/.version 2>/dev/null || echo latest)"

echo "== backup before updating"
$compose $profile run --rm backup backup.sh once

echo "== new code"
git pull --ff-only
version="$(git rev-parse --short HEAD)"

echo "== build and start $version (was $previous)"
ZENTRO_VERSION="$version" $compose $profile up -d --build

echo "$previous" >deploy/.previous-version
echo "$version" >deploy/.version
echo "== done. Roll back with: deploy/rollback.sh"
