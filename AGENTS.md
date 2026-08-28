# AGENTS.md

## Project

Node.js + TypeScript (ESM) Express wrapper around [Trafikverket Trafikinfo API v2](https://api.trafikinfo.trafikverket.se/v2/data.json). It queries Swedish train data (stations, train positions, announcements) as XML, maps PascalCase responses to camelCase DTOs, and exposes JSON over `/api`.

No tests, linter, or formatter are configured. There is no README.

## Setup

```bash
npm ci
cp .env.example .env   # set TRAFIKVERKET_API_KEY
npm run dev            # tsx watch, port 3000
```

- Node 24 (see `dockerfile`). Package manager is npm (`package-lock.json`).
- `.npmrc` maps `@jsr` to `https://npm.jsr.io` for `@libs/xml`.
- Required env: `TRAFIKVERKET_API_KEY`. Optional: `SERVER_PORT` (defined in `src/config.ts` but `src/app.ts` currently listens on `3000` hardcoded).
- Never commit `.env`. Never log or echo the API key.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Compile | `npm run build` (`tsc` → `dist/`) |
| Docker | `docker build -f dockerfile .` then run with `TRAFIKVERKET_API_KEY` |

After `npm run build`, run with `node dist/app.js` (Docker copies `dist` to `/app` and runs `node app.js`).

## Layout

```
src/app.ts                 # Express app, routes, swagger UI
src/config.ts              # dotenv + env
src/swagger.ts             # OpenAPI spec (swagger-jsdoc)
src/trafikverket/client.ts # POST XML → JSON, unwrap RESPONSE.RESULT[0][entityName]
src/common/view.ts         # HTML departure table (not currently wired from handlers)
src/{stations,train,announcement}/
  *-handler.ts             # Express Router + @openapi JSDoc
  *-service.ts             # fetch + DTO mapping
  *-queries.ts             # Trafikverket QUERY objects for @libs/xml stringify
```

HTTP surface:

- `GET /` — welcome
- `GET /health` — `OK`
- `GET /api-docs` — Swagger UI
- `GET /openapi.json`
- `GET /api/stations`
- `GET /api/stations/:station/departures` — query: `from`, `to`, `canceled`, `delayed`
- `GET /api/stations/:station/arrivals` — query: `from`, `to`, `canceled`, `delayed`
- `GET /api/trains/:trainId` — query: `from`, `to`
- `GET /api/train/position`
- `GET /api/announcements/departures/:from` — query: `from`, `to`, `canceled`, `delayed`
- `GET /api/announcements/train/:trainId` — query: `from`, `to`

`:from` on the legacy announcements route is a Trafikverket **location signature** (e.g. `Cst`), not a display name. Query `from`/`to` are ISO-8601 advertised-time bounds.

## Conventions

- `"type": "module"` + `module: nodenext`. Import local files with **`.js` extensions** even though sources are `.ts` (example: `import config from '../config.js'`). Do not switch to extensionless or `.ts` imports except where existing code already does.
- One domain folder: handler → service → queries → `client.post(query, EntityName)`.
- Keep Trafikverket wire types PascalCase; public JSON is camelCase DTOs via `build*Dto` helpers.
- Document new/changed routes with `@openapi` JSDoc on the handler. Shared schemas live in `src/swagger.ts`. After route changes, confirm `/openapi.json` still matches.
- Query objects use `@attribute` keys (`@objecttype`, `@name`, `@value`) because they are serialized to XML.
- TrainAnnouncement list queries have no default advertised-time window. Optional `from`/`to` query params become `GT`/`LT` on `AdvertisedTimeAtLocation`. The bulk operator join (`getAnnouncementsForTrainIdentsQuery`) keeps an internal ~24h/12h `$dateadd` bound. Invalid timestamps return JSON 400 `{ error }`.
- Prefer `async` route handlers and `res.json(...)`. Do not add a framework or ORM.

## When changing Trafikverket queries

- Match `@schemaversion` to the object type already used in that query file unless you are intentionally upgrading.
- `client.post` second argument must be the JSON entity key (`TrainStation`, `TrainPosition`, `TrainAnnouncement`).
- List announcement fetches use `client.postAllPages` (HTTP 206 pages). Failures are JSON 502 `{ error }`.
- `INCLUDE` only fields the DTO actually maps.
- Station lookups for `fromName`/`toName` call `fetchAllStations()` per request; do not add caching unless asked.

## Security and ops

- API key goes only in the XML `LOGIN.@authenticationkey` via config. Do not put keys in query files, tests, or docs examples.
- Dockerfile is lowercase `dockerfile`. Production image is `node:24-alpine`, non-root `USER node`. `EXPOSE $PORT` in the Dockerfile does not match `SERVER_PORT`; do not “fix” Docker unless the task is Docker-related.
