FROM grafana/loki:3.4.2

COPY loki.yml.tpl /etc/loki/loki.yml.tpl
COPY --chmod=755 entrypoint.sh /entrypoint.sh

USER root

ENTRYPOINT ["/entrypoint.sh"]
