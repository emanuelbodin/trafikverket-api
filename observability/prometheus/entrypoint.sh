#!/bin/sh
set -eu

# Railway interpolates ${{trafikverket-api.SERVER_PORT}} (PORT is injected at
# runtime and is not always available as a cross-service reference).
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
