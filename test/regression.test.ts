import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';

process.env.TRAFIKVERKET_API_KEY ??= 'test-key';

const { fetchTrainPositions } = await import('../src/train/train-service.ts');
const { app } = await import('../src/app.ts');
const { default: client } = await import('../src/trafikverket/client.ts');

describe('etapp 2 regression', { concurrency: 1 }, () => {

test('fetchTrainPositions maps a client.post array', async () => {
  const positions = await fetchTrainPositions({
    postAllPages: async () => [
      {
        Train: {
          OperationalTrainNumber: '12345',
          OperationalTrainDepartureDate: '2026-08-27',
          JourneyPlanNumber: '539',
          JourneyPlanDepartureDate: '2026-08-27',
          AdvertisedTrainNumber: '539',
        },
        Position: { WGS84: 'POINT (18.05 59.33)' },
        Status: { Active: true },
        ModifiedTime: '2026-08-27T12:00:00.000Z',
      },
    ],
  });

  assert.equal(positions.length, 1);
  assert.deepEqual(positions[0], {
    train: {
      operationalTrainNumber: '12345',
      operationalTrainDepartureDate: '2026-08-27',
      journeyPlanNumber: '539',
      journeyPlanDepartureDate: '2026-08-27',
      advertisedTrainNumber: '539',
    },
    position: { wgs84: 'POINT (18.05 59.33)' },
    status: { active: true },
    modifiedTime: '2026-08-27T12:00:00.000Z',
  });
  assert.equal(
    (positions as unknown as { TrainPosition?: unknown }).TrainPosition,
    undefined
  );
});

test('CORS headers are present on GET and OPTIONS preflight', async () => {
  const server = app.listen(0);
  after(() => {
    server.close();
  });
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const origin = 'https://tagkarta.example';

  const getRes = await fetch(`http://127.0.0.1:${port}/health`, {
    headers: { Origin: origin },
  });
  assert.equal(getRes.status, 200);
  assert.equal(await getRes.text(), 'OK');
  assert.equal(getRes.headers.get('access-control-allow-origin'), '*');

  const optionsRes = await fetch(
    `http://127.0.0.1:${port}/api/train/position`,
    {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    }
  );
  assert.ok(optionsRes.status === 204 || optionsRes.status === 200);
  assert.equal(optionsRes.headers.get('access-control-allow-origin'), '*');
});

const jsonResponse = (status: number, body: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

test('postAllPages continues on HTTP 206 using INFO.LASTCHANGEID', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const bodies: unknown[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(init?.body);
    if (bodies.length === 1) {
      return jsonResponse(206, {
        RESPONSE: {
          RESULT: [
            {
              TrainPosition: [{ id: 'a' }],
              INFO: { LASTCHANGEID: '10' },
            },
          ],
        },
      });
    }
    return jsonResponse(200, {
      RESPONSE: {
        RESULT: [
          {
            TrainPosition: [{ id: 'b' }],
            INFO: { LASTCHANGEID: '20' },
          },
        ],
      },
    });
  }) as typeof fetch;

  const items = await client.postAllPages<{ id: string }>(
    { '@objecttype': 'TrainPosition' },
    'TrainPosition'
  );

  assert.deepEqual(items, [{ id: 'a' }, { id: 'b' }]);
  assert.equal(bodies.length, 2);
  assert.match(String(bodies[0]), /changeid="0"/);
  assert.match(String(bodies[1]), /changeid="10"/);
});

test('postAllPages treats omitted entity key as empty/done', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async () =>
    jsonResponse(200, {
      RESPONSE: {
        RESULT: [{ INFO: { LASTCHANGEID: '1' } }],
      },
    })) as typeof fetch;

  const items = await client.postAllPages(
    { '@objecttype': 'TrainPosition' },
    'TrainPosition'
  );
  assert.deepEqual(items, []);
});

test('post still throws on HTTP 206', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async () =>
    jsonResponse(206, {
      RESPONSE: {
        RESULT: [
          {
            TrainAnnouncement: [{ id: 'x' }],
            INFO: { LASTCHANGEID: '9' },
          },
        ],
      },
    })) as typeof fetch;

  await assert.rejects(
    () =>
      client.post({ '@objecttype': 'TrainAnnouncement' }, 'TrainAnnouncement'),
    /206/
  );
});
});
