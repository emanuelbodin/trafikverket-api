#!/bin/sh
set -eu

TARGET="${API_SCRAPE_TARGET:-trafikverket-api.railway.internal:3000}"
LISTEN_PORT="${PORT:-9090}"

sed "s|__API_SCRAPE_TARGET__|${TARGET}|g" \
  /etc/prometheus/prometheus.yml.tpl > /tmp/prometheus.yml

exec /bin/prometheus \
  --config.file=/tmp/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --storage.tsdb.retention.time=15d \
  --web.listen-address=":${LISTEN_PORT}" \
  --web.enable-lifecycle
