# Trafikverket API

TypeScript/Express-API av [Emanuel Bodin](https://github.com/emanuelbodin) som är en wrapper kring [Trafikverkets öppna API för trafikinformation](https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/). Appen hämtar järnvägsdata (stationer, tågpositioner och tågannonseringar) och returnerar den som JSON.

Det här är en wrapper, inte Trafikverkets eget API. Bakom kulisserna skickas XML-frågor mot Trafikverkets `data.json`-endpoint.

## Förutsättningar

- **Node.js** och **npm**. `package.json` anger ingen `engines`-version. Dockerfilen bygger med `node:24-alpine`. TypeScript-målet är ES2023.
- En **API-nyckel** från Trafikverket (se [Konfiguration](#konfiguration)).

## Konfiguration

Kopiera exempel-filen och fyll i nyckeln:

```bash
cp .env.example .env
```

`.env.example` innehåller bara:

```
TRAFIKVERKET_API_KEY=
```

`TRAFIKVERKET_API_KEY` är **obligatorisk**. Saknas den (eller är tom) kastas `Required environment variable TRAFIKVERKET_API_KEY missing` när Trafikverket-klienten laddas, vilket i praktiken sker vid uppstart.

Nyckeln skapas i Trafikverkets datautbytesportal: [https://data.trafikverket.se/](https://data.trafikverket.se/). Registrera ett konto, verifiera e-postadressen och hämta nyckeln där. Mer bakgrund finns på [Trafikverkets sida om det öppna API:t](https://www.trafikverket.se/e-tjanster/trafikverkets-oppna-api-for-trafikinformation/).

Appen läser miljövariabler via `dotenv` från filen `.env` i arbetskatalogen. Variabler som redan finns i processmiljön används som vanligt.

`src/config.ts` läser även `SERVER_PORT` (standard `3000`), men `src/app.ts` anropar `app.listen(3000)` hårdkodat. **Lyssnarporten är 3000 oavsett `SERVER_PORT`.**

## Köra lokalt

```bash
npm install
cp .env.example .env   # om du inte redan har en .env
# fyll i TRAFIKVERKET_API_KEY i .env
npm run dev
```

`npm run dev` kör `tsx --watch src/app.ts` (omstart vid filändringar). Servern skriver `listening on port 3000`.

Bygg TypeScript till `dist/`:

```bash
npm run build
```

Det finns inget `start`-script i `package.json`. Den kompilerade appen kan köras med:

```bash
node dist/app.js
```

Kör kommandot från projektroten så att `.env` hittas.

Beroendet `@libs/xml` kommer från [JSR](https://jsr.io) via `.npmrc` (`@jsr:registry=https://npm.jsr.io`). `npm install` behöver den registret-konfigurationen.

## Docker

Repot har en flerstegs-`dockerfile` (gemener, inte `Dockerfile`) baserad på `node:24-alpine`. Imagen är inte byggd eller testad i den här miljön; nedanstående följer filen som den ser ut.

Bygg och kör (filnamnet måste anges eftersom det inte är `Dockerfile`):

```bash
docker build -f dockerfile -t trafikverket-api .
docker run --rm -p 3000:3000 -e TRAFIKVERKET_API_KEY=din-nyckel trafikverket-api
```

`.env` kopieras inte in i imagen. Skicka nyckeln som miljövariabel, som ovan.

Observera i `dockerfile`:

- Produktionssteget kör `node app.js` som användaren `node`, med kompilerad kod kopierad till `/app`.
- `ENV SERVER_PORT=3000` sätts, men appen lyssnar ändå på 3000 (se ovan).
- `EXPOSE $PORT` använder variabeln `PORT`, som inte sätts i filen. Räkna inte med att `EXPOSE` gör rätt — mappa värdport till **3000**.
- `.npmrc` kopieras inte in i npm-steget. `package-lock.json` pekar redan på `https://npm.jsr.io` för `@libs/xml`, så `npm ci` kan fungera ändå; det är inte verifierat här.

## Dokumentation (Swagger)

När servern körs:

| Resurs | Adress |
| --- | --- |
| Swagger UI | [http://localhost:3000/api-docs](http://localhost:3000/api-docs) |
| OpenAPI 3.0 JSON | [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json) |

Specen byggs av `swagger-jsdoc` från OpenAPI-kommentarer i `src/**/*.ts` plus scheman i `src/swagger.ts`. **Svarsformer och fält beskrivs där — README:n duplicerar dem inte.**

Swagger UI i Docker-imagen kan sakna endpoint-listan: imagen innehåller `dist/`, inte `src/`, och globben som läser JSDoc pekar på `./src/**/*.ts`.

## HTTP-endpoints

Alla API-svar är JSON (`res.json`). Det finns ingen HTML-variant i handlers, även om det finns oanvänd view-kod i `src/common/view.ts`.

| Metod | Sökväg | Vad koden gör |
| --- | --- | --- |
| `GET` | `/` | Text: välkomstmeddelande som pekar till `/api-docs` |
| `GET` | `/health` | Text: `OK` |
| `GET` | `/api-docs` | Swagger UI |
| `GET` | `/openapi.json` | OpenAPI-spec som JSON |
| `GET` | `/api/stations` | Annonserade tågstationer (`TrainStation` där `Advertised=true`) |
| `GET` | `/api/train/position` | Tågpositioner (`TrainPosition`) |
| `GET` | `/api/announcements/departures/:from` | Avgångar från en station |
| `GET` | `/api/announcements/train/:trainId` | Annonseringar för ett tågnummer |

Handlers har ingen egen felhantering. Misslyckade anrop mot Trafikverket blir Express fel (typiskt 500), inte ett dokumenterat JSON-felobjekt.

### `GET /api/stations`

Hämtar stationer med `Advertised=true` (inte hela Trafikverkets stationsmängd). Fält mappas till camelCase, se Swagger.

### `GET /api/train/position`

Frågan mot Trafikverket har `@limit=100`, namespace `järnväg.trafikinfo` och filter `ModifiedTime` nyare än `$dateadd(-00:00:59)`. Det är alltså inte “alla aktiva tåg”. Svarsformen enligt Swagger är camelCase-DTO:er; körningen mot live-API:t är inte verifierad i den här miljön.

### `GET /api/announcements/departures/:from`

`:from` är stationens **`LocationSignature`** (stationskod), inte visningsnamnet. Exempel som ofta används hos Trafikverket är `Cst` för Stockholm Central.

Bara `ActivityType=Avgang`. Tidsfönster: `AdvertisedTimeAtLocation` mellan ungefär 24 timmar bakåt (`$dateadd(-23:59:59)`) och 12 timmar framåt (`$dateadd(12:00:00)`).

Query-parametrar (endast värdet `true` räknas som sant):

| Parameter | Effekt |
| --- | --- |
| `canceled=true` | Skickas till Trafikverket som `Canceled=true` (bara inställda avgångar). Utelämnad eller annat värde skickas som inte inställd. |
| `delayed=true` | Filtreras **efter** svaret: behåll poster där `estimatedTimeAtLocation` skiljer sig från `advertisedTimeAtLocation`, eller där `canceled` är sant. |

Svaret är en lista av annonseringar med extra fälten `fromName` och `toName` (uppslag mot stationer). `toName` slås upp via första `toLocation.locationName` mot stationens `locationSignature`.

Exempel:

```bash
curl "http://localhost:3000/api/announcements/departures/Cst"
curl "http://localhost:3000/api/announcements/departures/Cst?delayed=true"
curl "http://localhost:3000/api/announcements/departures/Cst?canceled=true"
```

### `GET /api/announcements/train/:trainId`

`:trainId` matchar **`AdvertisedTrainIdent`**. Samma tidsfönster som avgångar (~24 h bakåt, 12 h framåt). Ingen `canceled`/`delayed`-filter. Samma DTO med `fromName`/`toName`.

```bash
curl "http://localhost:3000/api/announcements/train/1"
```

## Trafikverket-anrop

Klienten ligger i `src/trafikverket/client.ts`.

- **URL:** `https://api.trafikinfo.trafikverket.se/v2/data.json` (JSON-svar, XML-fråga)
- **Metod:** `POST`
- **Header:** `Content-Type: text/xml`
- **Auth:** API-nyckeln i XML som `REQUEST.LOGIN.@authenticationkey` (ingen HTTP-header-auth)

Frågan byggs med `@libs/xml` ungefär så här:

```xml
<REQUEST>
  <LOGIN authenticationkey="..." />
  <QUERY objecttype="..." schemaversion="...">
    <!-- FILTER och INCLUDE -->
  </QUERY>
</REQUEST>
```

Objekttyper som används:

| Objekttyp | Schemaversion | Används av |
| --- | --- | --- |
| `TrainStation` | 1.4 | `/api/stations` |
| `TrainAnnouncement` | 1.9 | avgångar från station |
| `TrainAnnouncement` | 1.8 | annonseringar för tågnummer |
| `TrainPosition` | 1.1 | `/api/train/position` |

Svaret läses som `RESPONSE.RESULT[0][entityName]`. Saknas den nyckeln kastas ett fel.

## Projektstruktur

```
src/
  app.ts                 Express-app, port 3000, routes
  config.ts              dotenv + TRAFIKVERKET_API_KEY / SERVER_PORT
  swagger.ts             OpenAPI-bas (info, servrar, scheman)
  trafikverket/client.ts XML-POST mot Trafikverket
  stations/              stationer
  train/                 tågpositioner
  announcement/          tågannonseringar
  common/view.ts         oanvänd HTML-vy (kopplas inte i handlers)
dockerfile               flerstegs-image (Node 24)
.env.example             TRAFIKVERKET_API_KEY
```

## Licens

`package.json` anger licensen **ISC**.
