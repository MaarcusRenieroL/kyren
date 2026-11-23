#!/bin/sh
# Every minute: Kyren's light background work. At 03:00 UTC: the heavy
# sweeps too (retention, purges, overdue notices, escalations).
#
# It also watches the app and alerts ALERT_WEBHOOK_URL once when something
# goes wrong and once when it recovers:
#   - the background-work call failing 3 times in a row
#   - /api/health/deep: the database down, or jobs stuck or newly dead
#   - the data disk (the uploads volume) above DISK_ALERT_PERCENT (85)

DISK_LIMIT="${DISK_ALERT_PERCENT:-85}"
failures=0
state_cron="ok"
state_health="ok"
state_disk="ok"
dead_seen=""

alert() {
  echo "monitor: $1"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -fsS -m 20 -H "Content-Type: application/json" \
      -d "{\"text\":\"Kyren: $1\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true
  fi
}

# Says something only when a check changes between ok and failing.
change() {
  name="$1"; now="$2"; was="$3"; message="$4"
  if [ "$now" != "$was" ]; then
    if [ "$now" = "ok" ]; then alert "$name recovered"; else alert "$message"; fi
  fi
}

while true; do
  query="?light=1"
  if [ "$(date -u +%H%M)" = "0300" ]; then
    query=""
  fi

  if curl -fsS -m 300 -H "Authorization: Bearer ${CRON_SECRET}" \
    "${CRON_URL}${query}" >/dev/null; then
    failures=0
    now="ok"
  else
    failures=$((failures + 1))
    now="$state_cron"
    [ "$failures" -ge 3 ] && now="failing"
  fi
  change "background work" "$now" "$state_cron" \
    "background work has failed $failures times in a row"
  state_cron="$now"

  if [ -n "${HEALTH_URL:-}" ]; then
    body="$(curl -sS -m 30 -H "Authorization: Bearer ${CRON_SECRET}" "$HEALTH_URL" || echo '{"status":"unreachable"}')"
    now="ok"
    case "$body" in
      *'"status":"ok"'*) ;;
      *) now="failing" ;;
    esac
    change "health" "$now" "$state_health" "health check failed: $body"
    state_health="$now"

    dead="$(echo "$body" | sed -n 's/.*"dead":\([0-9]*\).*/\1/p')"
    if [ -n "$dead" ] && [ -n "$dead_seen" ] && [ "$dead" -gt "$dead_seen" ]; then
      alert "$((dead - dead_seen)) background job(s) gave up after all retries"
    fi
    [ -n "$dead" ] && dead_seen="$dead"
  fi

  if [ -d /data/uploads ]; then
    used="$(df -P /data/uploads | awk 'NR==2 {gsub("%",""); print $5}')"
    now="ok"
    [ -n "$used" ] && [ "$used" -ge "$DISK_LIMIT" ] && now="failing"
    change "disk" "$now" "$state_disk" "data disk is ${used}% full"
    state_disk="$now"
  fi

  sleep 60
done
