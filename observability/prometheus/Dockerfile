FROM prom/prometheus:v2.55.1

COPY prometheus.yml.tpl /etc/prometheus/prometheus.yml.tpl
COPY --chmod=755 entrypoint.sh /entrypoint.sh

USER root

ENTRYPOINT ["/entrypoint.sh"]
