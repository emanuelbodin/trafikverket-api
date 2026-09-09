FROM grafana/loki:3.4.2

COPY loki.yml.tpl /etc/loki/loki.yml.tpl
COPY --chmod=755 entrypoint.sh /entrypoint.sh

USER root
RUN mkdir -p /loki/chunks /loki/rules /loki/compactor /loki/tsdb-index /loki/tsdb-cache \
  && chown -R loki:loki /loki /etc/loki /entrypoint.sh
USER loki

ENTRYPOINT ["/entrypoint.sh"]
