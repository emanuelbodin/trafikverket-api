# Trafikverket API

Express wrapper around [Trafikverket's open railway data](https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/). JSON for stations, train positions, and train announcements.

## Run locally

1. Get an API key from [https://data.trafikverket.se/](https://data.trafikverket.se/).
2. Copy `.env.example` to `.env` and set `TRAFIKVERKET_API_KEY`.
3. `npm install` then `npm run dev`.

Listens on port 3000.

The API is documented in Swagger at [http://localhost:3000/api-docs](http://localhost:3000/api-docs) (OpenAPI JSON at `/openapi.json`).

## Metrics

`GET /metrics` exposes Prometheus metrics (HTTP request rate/duration, Trafikverket client calls, and Node.js process defaults).

On Railway (project **tåg**):

- **prometheus** scrapes the API over private networking (`trafikverket-api.railway.internal`).
- **grafana** is public; sign in with user `admin` and the `GF_SECURITY_ADMIN_PASSWORD` set on that service. The **Trafikverket API** dashboard is provisioned automatically.
