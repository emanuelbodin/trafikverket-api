# Trafikverket API

Express wrapper around [Trafikverket's open railway data](https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/). JSON for stations, train positions, and train announcements.

## Run locally

1. Get an API key from [https://data.trafikverket.se/](https://data.trafikverket.se/).
2. Copy `.env.example` to `.env` and set `TRAFIKVERKET_API_KEY`.
3. `npm install` then `npm run dev`.

Listens on port 3000.

The API is documented in Swagger at [http://localhost:3000/api-docs](http://localhost:3000/api-docs) (OpenAPI JSON at `/openapi.json`).
