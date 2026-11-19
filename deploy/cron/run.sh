#!/bin/sh
# Every minute: the light background work. At 03:00 UTC: the heavy sweeps too
# (retention, purges, overdue notices, escalations).
while true; do
  query="?light=1"
  if [ "$(date -u +%H%M)" = "0300" ]; then
    query=""
  fi

  curl -fsS -m 300 -H "Authorization: Bearer ${CRON_SECRET}" \
    "${CRON_URL}${query}" >/dev/null || echo "cron run failed at $(date -u)"

  sleep 60
done
