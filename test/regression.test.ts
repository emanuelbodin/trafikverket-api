import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';

process.env.TRAFIKVERKET_API_KEY ??= 'test-key';

const { fetchTrainPositions } = await import('../src/train/train-service.ts');
const { getTrainPositionQuery } = await import('../src/train/train-queries.ts');
const { swaggerSpec } = await import('../src/swagger.ts');
const { app } = await import('../src/app.ts');
const { default: client } = await import('../src/trafikverket/client.ts');
const { stringify } = await import('@libs/xml');
const {
  getAnnouncementsForTrainIdentsQuery,
  TRAIN_IDENT_IN_BATCH_SIZE,
} = await import('../src/announcement/announcement-queries.ts');
const { buildJourneyMetaMap } = await import(
  '../src/announcement/announcement-service.ts'
);

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
  assert.equal('speed' in positions[0], false);
  assert.equal('bearing' in positions[0], false);
});

test('bulk TrainPosition query INCLUDEs Speed and Bearing', () => {
  const include = getTrainPositionQuery().INCLUDE;
  assert.ok(include.includes('Speed'));
  assert.ok(include.includes('Bearing'));
});

test('openapi TrainPositionSnapshot documents optional speed and bearing', () => {
  const spec = swaggerSpec as {
    components?: {
      schemas?: {
        TrainPositionSnapshot?: {
          properties?: Record<string, { type?: string }>;
        };
      };
    };
  };
  const props = spec.components?.schemas?.TrainPositionSnapshot?.properties;
  assert.equal(props?.speed?.type, 'number');
  assert.equal(props?.bearing?.type, 'number');
  assert.equal(props?.operator?.type, 'string');
  assert.ok(props?.train);
  assert.ok(props?.modifiedTime);
});

test('fetchTrainPositions maps speed when it is a finite number', async () => {
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
        Speed: 118,
      },
    ],
  });

  assert.equal(positions[0].speed, 118);
  assert.equal('bearing' in positions[0], false);
});

test('fetchTrainPositions omits speed when missing or not a finite number', async () => {
  const positions = await fetchTrainPositions({
    postAllPages: async () => [
      {
        Train: { AdvertisedTrainNumber: '1' },
        Position: { WGS84: 'POINT (18.05 59.33)' },
        Status: { Active: true },
        ModifiedTime: '2026-08-27T12:00:00.000Z',
      },
      {
        Train: { AdvertisedTrainNumber: '2' },
        Position: { WGS84: 'POINT (18.05 59.33)' },
        Status: { Active: true },
        ModifiedTime: '2026-08-27T12:00:00.000Z',
        Speed: Number.NaN,
      },
      {
        Train: { AdvertisedTrainNumber: '3' },
        Position: { WGS84: 'POINT (18.05 59.33)' },
        Status: { Active: true },
        ModifiedTime: '2026-08-27T12:00:00.000Z',
        Speed: Number.POSITIVE_INFINITY,
      },
    ],
  });

  assert.equal(positions.length, 3);
  for (const position of positions) {
    assert.equal('speed' in position, false);
    assert.equal(position.speed, undefined);
  }
});

test('fetchTrainPositions maps bearing only when present as a finite number', async () => {
  const positions = await fetchTrainPositions({
    postAllPages: async () => [
      {
        Train: { AdvertisedTrainNumber: '539' },
        Position: { WGS84: 'POINT (18.05 59.33)' },
        Status: { Active: true },
        ModifiedTime: '2026-08-27T12:00:00.000Z',
        Speed: 0,
        Bearing: 137.5,
      },
      {
        Train: { AdvertisedTrainNumber: '540' },
        Position: { WGS84: 'POINT (18.06 59.34)' },
        Status: { Active: true },
        ModifiedTime: '2026-08-27T12:00:01.000Z',
        Speed: 90,
      },
    ],
  });

  assert.equal(positions[0].speed, 0);
  assert.equal(positions[0].bearing, 137.5);
  assert.equal(positions[1].speed, 90);
  assert.equal('bearing' in positions[1], false);
  assert.equal(positions[1].bearing, undefined);
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

const snapshotPosition = (advertisedTrainNumber: string) => ({
  Train: {
    OperationalTrainNumber: advertisedTrainNumber,
    OperationalTrainDepartureDate: '2026-08-27',
    JourneyPlanNumber: advertisedTrainNumber,
    JourneyPlanDepartureDate: '2026-08-27',
    AdvertisedTrainNumber: advertisedTrainNumber,
  },
  Position: { WGS84: 'POINT (18.05 59.33)' },
  Status: { Active: true },
  ModifiedTime: '2026-08-27T12:00:00.000Z',
});

test('bulk announcement query uses Trafikverket IN on AdvertisedTrainIdent', () => {
  const xml = stringify({
    QUERY: getAnnouncementsForTrainIdentsQuery(['539', '540', '1']),
  });
  assert.match(
    xml,
    /<IN name="AdvertisedTrainIdent" value="539,540,1"\s*\/>/
  );
  assert.match(xml, /<INCLUDE>Operator<\/INCLUDE>/);
  assert.match(xml, /objecttype="TrainAnnouncement"/);
  assert.match(xml, /schemaversion="2.0"/);
  assert.match(xml, /namespace="Rail.TrafficInfo"/);
});

test('buildJourneyMetaMap takes first non-empty Operator per train', () => {
  const stations = new Map([
    ['Cst', 'Stockholm C'],
    ['G', 'Göteborg C'],
  ]);
  const map = buildJourneyMetaMap(
    [
      {
        AdvertisedTrainIdent: '539',
        Operator: '',
        ActivityType: 'Avgang',
        LocationSignature: 'Cst',
        ToLocation: { LocationName: 'G' },
        AdvertisedTimeAtLocation: '2026-08-27T10:00:00.000+02:00',
      },
      {
        AdvertisedTrainIdent: '539',
        Operator: 'SJ',
        ActivityType: 'Ankomst',
        LocationSignature: 'G',
        AdvertisedTimeAtLocation: '2026-08-27T13:00:00.000+02:00',
      },
      {
        AdvertisedTrainIdent: '540',
        Operator: 'ARRIVA',
        ActivityType: 'Avgang',
        LocationSignature: 'G',
        ToLocation: [{ LocationName: 'Cst' }],
        AdvertisedTimeAtLocation: '2026-08-27T11:00:00.000+02:00',
      },
    ],
    stations
  );

  assert.equal(map.get('539')?.operator, 'SJ');
  assert.equal(map.get('539')?.fromName, 'Stockholm C');
  assert.equal(map.get('539')?.toName, 'Göteborg C');
  assert.equal(map.get('540')?.operator, 'ARRIVA');
  assert.equal(map.get('540')?.fromName, 'Göteborg C');
  assert.equal(map.get('540')?.toName, 'Stockholm C');
});

test('fetchTrainPositions joins operator onto the DTO by advertised train number', async () => {
  const positions = await fetchTrainPositions({
    postAllPages: async (_query, entityName) => {
      if (entityName === 'TrainPosition') {
        return [
          { ...snapshotPosition('539'), Speed: 118, Bearing: 45 },
          snapshotPosition('540'),
        ];
      }
      assert.equal(entityName, 'TrainAnnouncement');
      return [
        { AdvertisedTrainIdent: '539', Operator: 'SJ' },
        { AdvertisedTrainIdent: '540', Operator: 'ARRIVA' },
      ];
    },
  });

  assert.equal(positions.length, 2);
  assert.equal(positions[0].operator, 'SJ');
  assert.equal(positions[0].speed, 118);
  assert.equal(positions[0].bearing, 45);
  assert.equal(positions[1].operator, 'ARRIVA');
  assert.equal('speed' in positions[1], false);
  assert.equal('bearing' in positions[1], false);
  assert.equal(positions[0].train.advertisedTrainNumber, '539');
  assert.equal(
    (positions[0].train as { operator?: string }).operator,
    undefined
  );
});

test('fetchTrainPositions omits operator when unknown and does not throw', async () => {
  const positions = await fetchTrainPositions({
    postAllPages: async (_query, entityName) => {
      if (entityName === 'TrainPosition') {
        return [snapshotPosition('539'), snapshotPosition('999')];
      }
      throw new Error('TrainAnnouncement lookup failed');
    },
  });

  assert.equal(positions.length, 2);
  assert.equal(positions[0].operator, undefined);
  assert.equal(positions[1].operator, undefined);
  assert.equal(positions[0].train.advertisedTrainNumber, '539');
  assert.equal(positions[1].train.advertisedTrainNumber, '999');
});

test('fetchTrainPositions does not call announcements once per train', async () => {
  const trainCount = TRAIN_IDENT_IN_BATCH_SIZE + 20;
  const trains = Array.from({ length: trainCount }, (_, i) =>
    snapshotPosition(String(i + 1))
  );
  let announcementCalls = 0;
  const inValues: string[] = [];

  const positions = await fetchTrainPositions({
    postAllPages: async (query, entityName) => {
      if (entityName === 'TrainPosition') return trains;
      announcementCalls += 1;
      const value = (query as { FILTER?: { AND?: { IN?: { '@value'?: string } } } })
        .FILTER?.AND?.IN?.['@value'];
      assert.ok(value, 'expected IN filter on AdvertisedTrainIdent');
      inValues.push(value);
      return value.split(',').map((ident) => ({
        AdvertisedTrainIdent: ident,
        Operator: 'SJ',
      }));
    },
  });

  assert.equal(positions.length, trainCount);
  assert.ok(positions.every((position) => position.operator === 'SJ'));
  assert.ok(announcementCalls >= 1);
  assert.ok(
    announcementCalls < trainCount,
    `expected bounded announcement calls, got ${announcementCalls} for ${trainCount} trains`
  );
  assert.equal(
    announcementCalls,
    Math.ceil(trainCount / TRAIN_IDENT_IN_BATCH_SIZE)
  );
  assert.equal(
    inValues.join(',').split(',').length,
    trainCount
  );
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
