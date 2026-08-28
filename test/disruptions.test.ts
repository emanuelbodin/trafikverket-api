import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';

process.env.TRAFIKVERKET_API_KEY ??= 'test-key';

const { stringify } = await import('@libs/xml');
const { swaggerSpec } = await import('../src/swagger.ts');
const { app } = await import('../src/app.ts');
const { clearStationsCache } = await import(
  '../src/stations/stations-service.ts'
);
const { getCurrentTrainMessagesQuery } = await import(
  '../src/disruptions/disruptions-queries.ts'
);
const {
  buildDisruptionDto,
  clearDisruptionsCache,
  DISRUPTIONS_CACHE_TTL_MS,
  fetchCurrentDisruptions,
} = await import('../src/disruptions/disruptions-service.ts');

const jsonResponse = (status: number, body: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

const stationRecord = (
  locationSignature: string,
  advertisedLocationName: string,
  advertisedShortLocationName = advertisedLocationName
) => ({
  AdvertisedLocationName: advertisedLocationName,
  LocationSignature: locationSignature,
  Geometry: { WGS84: 'POINT (18.05 59.33)' },
  PlatformLine: ['1'],
  LocationInformationText: '',
  AdvertisedShortLocationName: advertisedShortLocationName,
});

describe('etapp 3 disruptions', { concurrency: 1 }, () => {
  beforeEach(() => {
    clearDisruptionsCache();
    clearStationsCache();
  });

  test('maps a TrainMessage-like payload onto the DTO', () => {
    const names = new Map([
      ['Cst', 'Stockholm C'],
      ['U', 'Uppsala C'],
    ]);
    const dto = buildDisruptionDto(
      {
        EventId: 'evt-42',
        Header: 'Signalfel',
        ExternalDescription:
          'Tågtrafik påverkas mellan Stockholm C och Uppsala C.',
        ReasonCode: [
          { Code: 'ISE', Description: 'signalfel' },
          { Code: 'ISE', Description: 'signalfel' },
        ],
        StartDateTime: '2026-08-28T08:00:00.000+02:00',
        EndDateTime: '2026-08-28T18:00:00.000+02:00',
        ModifiedTime: '2026-08-28T09:15:00.000+02:00',
        TrafficImpact: {
          IsConfirmed: true,
          AffectedLocation: [
            { LocationSignature: 'Cst', ShouldBeTrafficInformed: true },
            { LocationSignature: 'U', ShouldBeTrafficInformed: true },
            { LocationSignature: 'X', ShouldBeTrafficInformed: false },
          ],
          AffectedTrain: ['539', '540'],
        },
      },
      names
    );

    assert.deepEqual(dto, {
      id: 'evt-42',
      header: 'Signalfel',
      description: 'Tågtrafik påverkas mellan Stockholm C och Uppsala C.',
      reason: 'signalfel',
      startTime: '2026-08-28T08:00:00.000+02:00',
      endTime: '2026-08-28T18:00:00.000+02:00',
      stations: [
        { signature: 'Cst', name: 'Stockholm C' },
        { signature: 'U', name: 'Uppsala C' },
      ],
      trains: ['539', '540'],
      modifiedTime: '2026-08-28T09:15:00.000+02:00',
    });
    assert.equal(
      (dto as unknown as { ReasonCode?: unknown }).ReasonCode,
      undefined
    );
    assert.equal(
      (dto as unknown as { ExternalDescription?: unknown }).ExternalDescription,
      undefined
    );
  });

  test('omits empty optional fields and does not use ReasonCode.Code as reason', () => {
    const dto = buildDisruptionDto({
      EventId: 'evt-1',
      ReasonCode: { Code: 'ISE' },
    });
    assert.deepEqual(dto, { id: 'evt-1' });
    assert.equal('reason' in dto!, false);
    assert.equal('header' in dto!, false);
    assert.equal('stations' in dto!, false);
    assert.equal('trains' in dto!, false);
  });

  test('empty upstream returns []', async () => {
    const disruptions = await fetchCurrentDisruptions({
      tv: { postAllPages: async () => [] },
      now: () => 1,
    });
    assert.deepEqual(disruptions, []);
  });

  test('station filter excludes unrelated events', async () => {
    const names = new Map([
      ['Cst', 'Stockholm C'],
      ['G', 'Göteborg C'],
    ]);
    const disruptions = await fetchCurrentDisruptions({
      tv: {
        postAllPages: async () => [
          {
            EventId: 'cst-only',
            TrafficImpact: {
              AffectedLocation: [{ LocationSignature: 'Cst' }],
            },
          },
          {
            EventId: 'gothenburg',
            TrafficImpact: {
              AffectedLocation: [{ LocationSignature: 'G' }],
            },
          },
        ],
      },
      now: () => 1,
      stationSignature: 'Cst',
      stationNameBySignature: names,
    });

    assert.equal(disruptions.length, 1);
    assert.equal(disruptions[0].id, 'cst-only');
    assert.deepEqual(disruptions[0].stations, [
      { signature: 'Cst', name: 'Stockholm C' },
    ]);
  });

  test('cache: two fetches within TTL only query Trafikverket once', async () => {
    let calls = 0;
    const tv = {
      postAllPages: async () => {
        calls += 1;
        return [{ EventId: 'cached' }];
      },
    };
    let nowMs = 1_000;
    const now = () => nowMs;

    const first = await fetchCurrentDisruptions({ tv, now });
    const second = await fetchCurrentDisruptions({ tv, now });
    assert.equal(calls, 1);
    assert.equal(first[0].id, 'cached');
    assert.equal(second[0].id, 'cached');

    nowMs += DISRUPTIONS_CACHE_TTL_MS + 1;
    const third = await fetchCurrentDisruptions({ tv, now });
    assert.equal(calls, 2);
    assert.equal(third[0].id, 'cached');
  });

  test('maps top-level AffectedLocation and AffectedTrain after shrinking INCLUDE', () => {
    const names = new Map([['Cst', 'Stockholm C']]);
    const dto = buildDisruptionDto(
      {
        EventId: 'evt-top',
        Header: 'Banarbete',
        AffectedLocation: ['Cst', { LocationSignature: 'U' }],
        AffectedTrain: '539',
      },
      names
    );
    assert.equal(dto?.id, 'evt-top');
    assert.deepEqual(dto?.stations, [
      { signature: 'Cst', name: 'Stockholm C' },
      { signature: 'U', name: 'U' },
    ]);
    assert.deepEqual(dto?.trains, ['539']);
  });

  test('TrainMessage query is schema 1.7 without FILTER or full TrafficImpact', () => {
    const xml = stringify({ QUERY: getCurrentTrainMessagesQuery() });
    assert.match(xml, /objecttype="TrainMessage"/);
    assert.match(xml, /schemaversion="1.7"/);
    assert.doesNotMatch(xml, /namespace=/);
    assert.doesNotMatch(xml, /<FILTER>/);
    assert.doesNotMatch(xml, /\$now/);
    assert.doesNotMatch(xml, /<INCLUDE>TrafficImpact<\/INCLUDE>/);
    assert.match(xml, /<INCLUDE>EventId<\/INCLUDE>/);
    assert.match(xml, /<INCLUDE>ExternalDescription<\/INCLUDE>/);
    assert.match(xml, /<INCLUDE>TrafficImpact.AffectedLocation<\/INCLUDE>/);
    assert.match(xml, /<INCLUDE>AffectedLocation<\/INCLUDE>/);
    assert.match(xml, /<INCLUDE>AffectedTrain<\/INCLUDE>/);
  });

  test('openapi documents GET /api/disruptions', () => {
    const spec = swaggerSpec as {
      paths?: Record<string, { get?: { summary?: string } }>;
      components?: {
        schemas?: { Disruption?: { properties?: Record<string, unknown> } };
      };
    };
    assert.ok(spec.paths?.['/api/disruptions']?.get);
    assert.match(
      spec.paths?.['/api/disruptions']?.get?.summary ?? '',
      /disruption/i
    );
    const props = spec.components?.schemas?.Disruption?.properties;
    assert.ok(props?.id);
    assert.ok(props?.reason);
    assert.ok(props?.stations);
    assert.ok(props?.trains);
  });

  test('GET /api/disruptions uses station lookup and returns 400/404 like stations', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (!target.includes('api.trafikinfo.trafikverket.se')) {
        return originalFetch(url as RequestInfo, init);
      }
      const body = String(init?.body ?? '');
      if (body.includes('objecttype="TrainStation"')) {
        return jsonResponse(200, {
          RESPONSE: {
            RESULT: [
              {
                TrainStation: [
                  stationRecord('Cst', 'Stockholm C'),
                  stationRecord('Sst', 'Stockholm Södra', 'Stockholm S'),
                  stationRecord('U', 'Uppsala C', 'Uppsala'),
                ],
              },
            ],
          },
        });
      }
      if (body.includes('objecttype="TrainMessage"')) {
        return jsonResponse(200, {
          RESPONSE: {
            RESULT: [
              {
                TrainMessage: [
                  {
                    EventId: 'cst-event',
                    Header: 'Banarbete',
                    TrafficImpact: {
                      AffectedLocation: [{ LocationSignature: 'Cst' }],
                    },
                  },
                  {
                    EventId: 'uppsala-event',
                    TrafficImpact: {
                      AffectedLocation: [{ LocationSignature: 'U' }],
                    },
                  },
                ],
              },
            ],
          },
        });
      }
      throw new Error(`unexpected fetch body: ${body}`);
    }) as typeof fetch;

    const server = app.listen(0);
    after(() => {
      server.close();
    });
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    const unknown = await fetch(`${base}/api/disruptions?station=Nowhere`);
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { error: 'Station not found' });

    const ambiguous = await fetch(`${base}/api/disruptions?station=Stockholm`);
    assert.equal(ambiguous.status, 400);
    const ambiguousBody = (await ambiguous.json()) as {
      error: string;
      candidates: { id: string; name: string }[];
    };
    assert.equal(ambiguousBody.error, 'Ambiguous station');
    assert.ok(ambiguousBody.candidates.length >= 2);

    const filtered = await fetch(`${base}/api/disruptions?station=Cst`);
    assert.equal(filtered.status, 200);
    const filteredBody = (await filtered.json()) as { id: string }[];
    assert.deepEqual(
      filteredBody.map((item) => item.id),
      ['cst-event']
    );

    const emptyFilter = await fetch(`${base}/api/disruptions?station=Uppsala`);
    assert.equal(emptyFilter.status, 200);
    const uppsala = (await emptyFilter.json()) as { id: string }[];
    assert.deepEqual(
      uppsala.map((item) => item.id),
      ['uppsala-event']
    );
  });

  test('GET /api/disruptions returns [] when upstream is empty', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (!target.includes('api.trafikinfo.trafikverket.se')) {
        return originalFetch(url as RequestInfo, init);
      }
      const body = String(init?.body ?? '');
      if (body.includes('objecttype="TrainStation"')) {
        return jsonResponse(200, {
          RESPONSE: { RESULT: [{ TrainStation: [] }] },
        });
      }
      return jsonResponse(200, {
        RESPONSE: { RESULT: [{ INFO: { LASTCHANGEID: '1' } }] },
      });
    }) as typeof fetch;

    const server = app.listen(0);
    after(() => {
      server.close();
    });
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/disruptions`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  });

  test('GET /api/disruptions returns JSON 502 when postAllPages throws', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (!target.includes('api.trafikinfo.trafikverket.se')) {
        return originalFetch(url as RequestInfo, init);
      }
      const body = String(init?.body ?? '');
      if (body.includes('objecttype="TrainStation"')) {
        return jsonResponse(200, {
          RESPONSE: { RESULT: [{ TrainStation: [] }] },
        });
      }
      return jsonResponse(200, {
        RESPONSE: {
          RESULT: [
            {
              ERROR: {
                SOURCE: 'Request',
                MESSAGE: 'Invalid filter',
              },
            },
          ],
        },
      });
    }) as typeof fetch;

    const server = app.listen(0);
    after(() => {
      server.close();
    });
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/disruptions`);
    assert.equal(res.status, 502);
    assert.match(res.headers.get('content-type') ?? '', /json/);
    const body = (await res.json()) as { error: string };
    assert.equal(typeof body.error, 'string');
    assert.match(body.error, /Invalid filter/);
  });

  test('GET /api/disruptions returns 200 JSON when 206 has no LASTCHANGEID', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (!target.includes('api.trafikinfo.trafikverket.se')) {
        return originalFetch(url as RequestInfo, init);
      }
      const body = String(init?.body ?? '');
      if (body.includes('objecttype="TrainStation"')) {
        return jsonResponse(200, {
          RESPONSE: {
            RESULT: [{ TrainStation: [stationRecord('Cst', 'Stockholm C')] }],
          },
        });
      }
      return jsonResponse(206, {
        RESPONSE: {
          RESULT: [
            {
              TrainMessage: [
                {
                  EventId: 'partial-page',
                  Header: 'Signalfel',
                  AffectedLocation: [{ LocationSignature: 'Cst' }],
                },
              ],
            },
          ],
        },
      });
    }) as typeof fetch;

    const server = app.listen(0);
    after(() => {
      server.close();
    });
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/disruptions`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /json/);
    const body = (await res.json()) as { id: string; header?: string }[];
    assert.equal(Array.isArray(body), true);
    assert.equal(body[0]?.id, 'partial-page');
    assert.equal(body[0]?.header, 'Signalfel');
  });
});
