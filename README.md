# Trafikverket API

TypeScript/Express API by [Emanuel Bodin](https://github.com/emanuelbodin) that wraps [Trafikverkets öppna API för trafikinformation](https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/). The app fetches railway data (stations, train positions, and train announcements) and returns it as JSON.

This is a wrapper, not Trafikverket's own API. Behind the scenes, XML queries are posted to Trafikverket's `data.json` endpoint.

## Prerequisites

- **Node.js** and **npm**. `package.json` does not specify an `engines` version. The dockerfile builds with `node:24-alpine`. The TypeScript target is ES2023.
- An **API key** from Trafikverket (see [Configuration](#configuration)).

## Configuration

Copy the example file and fill in the key:

```bash
cp .env.example .env
```

`.env.example` contains only:

```
TRAFIKVERKET_API_KEY=
```

`TRAFIKVERKET_API_KEY` is **required**. If it is missing (or empty), `Required environment variable TRAFIKVERKET_API_KEY missing` is thrown when the Trafikverket client is loaded, which in practice happens at startup.

The key is created in Trafikverket's Datautbytesportal: [https://data.trafikverket.se/](https://data.trafikverket.se/). Register an account, verify the email address, and retrieve the key there. More background is on [Trafikverket's page about the open API](https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/).

The app reads environment variables via `dotenv` from the `.env` file in the working directory. Variables that already exist in the process environment are used as usual.

`src/config.ts` also reads `SERVER_PORT` (default `3000`), but `src/app.ts` calls `app.listen(3000)` with a hardcoded port. **The listen port is 3000 regardless of `SERVER_PORT`.**

## Running locally

```bash
npm install
cp .env.example .env   # if you do not already have a .env
# set TRAFIKVERKET_API_KEY in .env
npm run dev
```

`npm run dev` runs `tsx --watch src/app.ts` (restart on file changes). The server prints `listening on port 3000`.

Build TypeScript to `dist/`:

```bash
npm run build
```

There is no `start` script in `package.json`. The compiled app can be run with:

```bash
node dist/app.js
```

Run the command from the project root so that `.env` is found.

The `@libs/xml` dependency comes from [JSR](https://jsr.io) via `.npmrc` (`@jsr:registry=https://npm.jsr.io`). `npm install` needs that registry configuration.

## Docker

The repo has a multi-stage `dockerfile` (lowercase, not `Dockerfile`) based on `node:24-alpine`. The image was not built or tested in this environment; the following follows the file as it stands.

Build and run (the filename must be specified because it is not `Dockerfile`):

```bash
docker build -f dockerfile -t trafikverket-api .
docker run --rm -p 3000:3000 -e TRAFIKVERKET_API_KEY=your-key trafikverket-api
```

`.env` is not copied into the image. Pass the key as an environment variable, as above.

Notes from `dockerfile`:

- The production stage runs `node app.js` as the `node` user, with compiled code copied to `/app`.
- `ENV SERVER_PORT=3000` is set, but the app still listens on 3000 (see above).
- `EXPOSE $PORT` uses the `PORT` variable, which is not set in the file. Do not rely on `EXPOSE` being correct — map the host port to **3000**.
- `.npmrc` is not copied into the npm stage. `package-lock.json` already points at `https://npm.jsr.io` for `@libs/xml`, so `npm ci` may still work; that is not verified here.

## Documentation (Swagger)

When the server is running:

| Resource | URL |
| --- | --- |
| Swagger UI | [http://localhost:3000/api-docs](http://localhost:3000/api-docs) |
| OpenAPI 3.0 JSON | [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json) |

The spec is built by `swagger-jsdoc` from OpenAPI comments in `src/**/*.ts` plus schemas in `src/swagger.ts`. **Response shapes and fields are described there — this README does not duplicate them.**

Swagger UI in the Docker image may be missing the endpoint list: the image contains `dist/`, not `src/`, and the glob that reads JSDoc points at `./src/**/*.ts`.

## HTTP endpoints

All API responses are JSON (`res.json`). There is no HTML variant in the handlers, even though unused view code exists in `src/common/view.ts`.

| Method | Path | What the code does |
| --- | --- | --- |
| `GET` | `/` | Text: welcome message pointing to `/api-docs` |
| `GET` | `/health` | Text: `OK` |
| `GET` | `/api-docs` | Swagger UI |
| `GET` | `/openapi.json` | OpenAPI spec as JSON |
| `GET` | `/api/stations` | Advertised train stations (`TrainStation` where `Advertised=true`) |
| `GET` | `/api/train/position` | Train positions (`TrainPosition`) |
| `GET` | `/api/announcements/departures/:from` | Departures from a station |
| `GET` | `/api/announcements/train/:trainId` | Announcements for a train number |

Handlers have no dedicated error handling. Failed calls to Trafikverket become Express errors (typically 500), not a documented JSON error object.

### `GET /api/stations`

Fetches stations with `Advertised=true` (not Trafikverket's full station set). Fields are mapped to camelCase; see Swagger.

### `GET /api/train/position`

The query to Trafikverket has `@limit=100`, namespace `järnväg.trafikinfo`, and a `ModifiedTime` filter newer than `$dateadd(-00:00:59)`. It is therefore not “all active trains”. The response shape according to Swagger is camelCase DTOs; a live-API run was not verified in this environment.

### `GET /api/announcements/departures/:from`

`:from` is the station's **`LocationSignature`** (station code), not the display name. An example often used at Trafikverket is `Cst` for Stockholm Central.

Only `ActivityType=Avgang`. Time window: `AdvertisedTimeAtLocation` between about 24 hours back (`$dateadd(-23:59:59)`) and 12 hours ahead (`$dateadd(12:00:00)`).

Query parameters (only the value `true` counts as true):

| Parameter | Effect |
| --- | --- |
| `canceled=true` | Sent to Trafikverket as `Canceled=true` (canceled departures only). Omitted or any other value is sent as not canceled. |
| `delayed=true` | Filtered **after** the response: keep records where `estimatedTimeAtLocation` differs from `advertisedTimeAtLocation`, or where `canceled` is true. |

The response is a list of announcements with the extra fields `fromName` and `toName` (looked up against stations). `toName` is resolved via the first `toLocation.locationName` against the station's `locationSignature`.

Examples:

```bash
curl "http://localhost:3000/api/announcements/departures/Cst"
curl "http://localhost:3000/api/announcements/departures/Cst?delayed=true"
curl "http://localhost:3000/api/announcements/departures/Cst?canceled=true"
```

### `GET /api/announcements/train/:trainId`

`:trainId` matches **`AdvertisedTrainIdent`**. Same time window as departures (~24 h back, 12 h ahead). No `canceled`/`delayed` filter. Same DTO with `fromName`/`toName`.

```bash
curl "http://localhost:3000/api/announcements/train/1"
```

## Trafikverket requests

The client lives in `src/trafikverket/client.ts`.

- **URL:** `https://api.trafikinfo.trafikverket.se/v2/data.json` (JSON response, XML query)
- **Method:** `POST`
- **Header:** `Content-Type: text/xml`
- **Auth:** the API key in XML as `REQUEST.LOGIN.@authenticationkey` (no HTTP header auth)

The query is built with `@libs/xml` roughly like this:

```xml
<REQUEST>
  <LOGIN authenticationkey="..." />
  <QUERY objecttype="..." schemaversion="...">
    <!-- FILTER and INCLUDE -->
  </QUERY>
</REQUEST>
```

Object types used:

| Object type | Schema version | Used by |
| --- | --- | --- |
| `TrainStation` | 1.4 | `/api/stations` |
| `TrainAnnouncement` | 1.9 | departures from a station |
| `TrainAnnouncement` | 1.8 | announcements for a train number |
| `TrainPosition` | 1.1 | `/api/train/position` |

The response is read as `RESPONSE.RESULT[0][entityName]`. If that key is missing, an error is thrown.

## Project structure

```
src/
  app.ts                 Express app, port 3000, routes
  config.ts              dotenv + TRAFIKVERKET_API_KEY / SERVER_PORT
  swagger.ts             OpenAPI base (info, servers, schemas)
  trafikverket/client.ts XML POST to Trafikverket
  stations/              stations
  train/                 train positions
  announcement/          train announcements
  common/view.ts         unused HTML view (not wired up in handlers)
dockerfile               multi-stage image (Node 24)
.env.example             TRAFIKVERKET_API_KEY
```

## License

`package.json` specifies the license **ISC**.
