# Trafikverket API

Express wrapper around [Trafikverket's open railway data](https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/). JSON for stations, train positions, and train announcements.

## Run locally

1. Get an API key from [https://data.trafikverket.se/](https://data.trafikverket.se/).
2. Copy `.env.example` to `.env` and set `TRAFIKVERKET_API_KEY`.
3. `npm install` then `npm run dev`.

Listens on port 3000.

The API is documented in Swagger at [http://localhost:3000/api-docs](http://localhost:3000/api-docs) (OpenAPI JSON at `/openapi.json`).

## Metrics and logs

`GET /metrics` exposes Prometheus metrics (HTTP request rate/duration, Trafikverket client calls, and Node.js process defaults).

The API writes structured JSON logs to stdout (pino). Each request gets an `X-Request-Id` (echoed from the incoming header, or generated). `/health` and `/metrics` are not access-logged. Optional `LOKI_URL` also pushes the same logs to Loki.

On Railway (project **tåg**):

- **prometheus** scrapes `GET /metrics` over private networking (`trafikverket-api.railway.internal:${SERVER_PORT}`).
- **loki** is private. Build from `observability/loki`. Pin `PORT`/`SERVER_PORT` to `3100` (Railway `PORT` is not always interpolable across services).
- **grafana** is public; sign in with user `admin` and the `GF_SECURITY_ADMIN_PASSWORD` set on that service. Set `PROMETHEUS_URL` and `LOKI_URL` (e.g. `http://${{loki.RAILWAY_PRIVATE_DOMAIN}}:3100`). The **Trafikverket API**, **SLOs**, and **Logs** dashboards are provisioned automatically.
- **trafikverket-api** should set `LOKI_URL` to the same Loki private URL so logs appear in Grafana.

Proposed SLOs (availability, latency, process up, Trafikverket dependency) are in [`observability/slos.md`](observability/slos.md).
