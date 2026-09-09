#!/bin/sh
set -eu

LISTEN_PORT="${PORT:-3100}"

mkdir -p \
  /loki/chunks \
  /loki/rules \
  /loki/compactor \
  /loki/tsdb-index \
  /loki/tsdb-cache

sed "s/__LISTEN_PORT__/${LISTEN_PORT}/g" \
  /etc/loki/loki.yml.tpl > /tmp/loki.yml

exec /usr/bin/loki -config.file=/tmp/loki.yml
