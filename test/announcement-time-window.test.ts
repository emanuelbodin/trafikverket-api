import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';

process.env.TRAFIKVERKET_API_KEY ??= 'test-key';

const { stringify } = await import('@libs/xml');
const { swaggerSpec } = await import('../src/swagger.ts');
const { app } = await import('../src/app.ts');
const { parseAdvertisedTimeWindow } = await import(
  '../src/announcement/advertised-time-window.ts'
);
const {
  getAnnouncementsAtStationQuery,
  getAnnouncementsForTrainIdentsQuery,
  getAnnouncementsForTrainQuery,
} = await import('../src/announcement/announcement-queries.ts');
const { clearStationsCache } = await import(
  '../src/stations/stations-service.ts'
);

const jsonResponse = (status: number, body: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

const stationRecord = (
  locationSignature: string,
  advertisedLocationName: string
) => ({
  AdvertisedLocationName: advertisedLocationName,
  LocationSignature: locationSignature,
  Geometry: { WGS84: 'POINT (18.05 59.33)' },
  PlatformLine: ['1'],
  LocationInformationText: '',
  AdvertisedShortLocationName: advertisedLocationName,
});

describe('advertised time window', { concurrency: 1 }, () => {
  beforeEach(() => {
    clearStationsCache();
  });

  test('station and train queries omit $dateadd when from/to are omitted', () => {
    const stationXml = stringify({
      QUERY: getAnnouncementsAtStationQuery('Cst', 'Avgang'),
    });
    const trainXml = stringify({
      QUERY: getAnnouncementsForTrainQuery('539'),
    });

    for (const xml of [stationXml, trainXml]) {
      assert.doesNotMatch(xml, /\$dateadd\(-23:59:59\)/);
      assert.doesNotMatch(xml, /\$dateadd\(12:00:00\)/);
      assert.doesNotMatch(
        xml,
        /<(GT|LT) name="AdvertisedTimeAtLocation"/
      );
    }
  });

  test('from and/or to appear as GT/LT on AdvertisedTimeAtLocation', () => {
    const from = '2026-08-28T00:00:00+02:00';
    const to = '2026-08-28T12:00:00+02:00';

    const both = stringify({
      QUERY: getAnnouncementsAtStationQuery('Cst', 'Avgang', undefined, {
        from,
        to,
      }),
    });
    assert.match(
      both,
      /<GT name="AdvertisedTimeAtLocation" value="2026-08-28T00:00:00\+02:00"\s*\/>/
    );
    assert.match(
      both,
      /<LT name="AdvertisedTimeAtLocation" value="2026-08-28T12:00:00\+02:00"\s*\/>/
    );
    assert.doesNotMatch(both, /\$dateadd/);

    const onlyFrom = stringify({
      QUERY: getAnnouncementsForTrainQuery('539', { from }),
    });
    assert.match(
      onlyFrom,
      /<GT name="AdvertisedTimeAtLocation" value="2026-08-28T00:00:00\+02:00"\s*\/>/
    );
    assert.doesNotMatch(
      onlyFrom,
      /<LT name="AdvertisedTimeAtLocation"/
    );

    const onlyTo = stringify({
      QUERY: getAnnouncementsForTrainQuery('539', { to }),
    });
    assert.match(
      onlyTo,
      /<LT name="AdvertisedTimeAtLocation" value="2026-08-28T12:00:00\+02:00"\s*\/>/
    );
    assert.doesNotMatch(
      onlyTo,
      /<GT name="AdvertisedTimeAtLocation"/
    );
  });

  test('operator bulk join still has an internal time bound', () => {
    const xml = stringify({
      QUERY: getAnnouncementsForTrainIdentsQuery(['539', '540']),
    });
    assert.match(xml, /\$dateadd\(-23:59:59\)/);
    assert.match(xml, /\$dateadd\(12:00:00\)/);
    assert.match(
      xml,
      /<GT name="AdvertisedTimeAtLocation" value="\$dateadd\(-23:59:59\)"\s*\/>/
    );
    assert.match(
      xml,
      /<LT name="AdvertisedTimeAtLocation" value="\$dateadd\(12:00:00\)"\s*\/>/
    );
  });

  test('400 on bad from/to', () => {
    const invalidFrom = parseAdvertisedTimeWindow({ from: 'not-a-date' });
    assert.equal(invalidFrom.ok, false);
    if (!invalidFrom.ok) assert.match(invalidFrom.error, /from/i);

    const invalidTo = parseAdvertisedTimeWindow({ to: 'yesterday' });
    assert.equal(invalidTo.ok, false);
    if (!invalidTo.ok) assert.match(invalidTo.error, /to/i);

    const inverted = parseAdvertisedTimeWindow({
      from: '2026-08-28T12:00:00+02:00',
      to: '2026-08-28T00:00:00+02:00',
    });
    assert.equal(inverted.ok, false);
    if (!inverted.ok) assert.match(inverted.error, /after/i);

    const ok = parseAdvertisedTimeWindow({
      from: '2026-08-28T00:00:00+02:00',
      to: '2026-08-28T12:00:00+02:00',
    });
    assert.equal(ok.ok, true);
  });

  test('departures handler forwards from/to and rejects invalid timestamps', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    const announcementBodies: string[] = [];
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
      if (body.includes('objecttype="TrainAnnouncement"')) {
        announcementBodies.push(body);
        return jsonResponse(200, {
          RESPONSE: { RESULT: [{ TrainAnnouncement: [] }] },
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

    const from = encodeURIComponent('2026-08-28T00:00:00+02:00');
    const to = encodeURIComponent('2026-08-28T12:00:00+02:00');
    const ok = await fetch(
      `${base}/api/stations/Cst/departures?from=${from}&to=${to}`
    );
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), []);
    assert.equal(announcementBodies.length, 1);
    assert.match(
      announcementBodies[0],
      /<GT name="AdvertisedTimeAtLocation" value="2026-08-28T00:00:00\+02:00"\s*\/>/
    );
    assert.match(
      announcementBodies[0],
      /<LT name="AdvertisedTimeAtLocation" value="2026-08-28T12:00:00\+02:00"\s*\/>/
    );
    assert.doesNotMatch(announcementBodies[0], /\$dateadd/);

    const bad = await fetch(
      `${base}/api/stations/Cst/departures?from=not-a-date`
    );
    assert.equal(bad.status, 400);
    assert.match(bad.headers.get('content-type') ?? '', /json/);
    const badBody = (await bad.json()) as { error: string };
    assert.equal(typeof badBody.error, 'string');
    assert.match(badBody.error, /from/i);

    const inverted = await fetch(
      `${base}/api/stations/Cst/departures?from=${to}&to=${from}`
    );
    assert.equal(inverted.status, 400);
    const invertedBody = (await inverted.json()) as { error: string };
    assert.match(invertedBody.error, /after/i);

    announcementBodies.length = 0;
    const unbounded = await fetch(`${base}/api/stations/Cst/departures`);
    assert.equal(unbounded.status, 200);
    assert.equal(announcementBodies.length, 1);
    assert.doesNotMatch(announcementBodies[0], /\$dateadd\(-23:59:59\)/);
    assert.doesNotMatch(announcementBodies[0], /\$dateadd\(12:00:00\)/);
  });

  test('GET /api/stations/:station/departures returns JSON 502 when paging fails', async (t) => {
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
              TrainAnnouncement: [{ ActivityId: 'partial' }],
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
    const res = await fetch(
      `http://127.0.0.1:${port}/api/stations/Cst/departures`
    );
    assert.equal(res.status, 502);
    assert.match(res.headers.get('content-type') ?? '', /json/);
    const body = (await res.json()) as { error: string };
    assert.equal(typeof body.error, 'string');
  });

  test('openapi documents from/to and drops the hardcoded 24h/12h window', () => {
    const spec = swaggerSpec as {
      paths?: Record<
        string,
        { get?: { description?: string; parameters?: unknown[] } }
      >;
    };

    const dumped = JSON.stringify(spec);
    assert.doesNotMatch(dumped, /24 hours back/);
    assert.doesNotMatch(dumped, /12 hours ahead/);
    assert.doesNotMatch(dumped, /about 24 hours ago/);

    const paths = [
      '/api/stations/{station}/departures',
      '/api/stations/{station}/arrivals',
      '/api/trains/{trainId}',
      '/api/announcements/departures/{from}',
      '/api/announcements/train/{trainId}',
    ];
    for (const path of paths) {
      assert.ok(spec.paths?.[path]?.get, `missing ${path}`);
      const desc = spec.paths?.[path]?.get?.description ?? '';
      assert.doesNotMatch(desc, /24 hours/);
      assert.doesNotMatch(desc, /12 hours/);
    }
  });
});
