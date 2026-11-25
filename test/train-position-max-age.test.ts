import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';

process.env.TRAFIKVERKET_API_KEY ??= 'test-key';

const { stringify } = await import('@libs/xml');
const { swaggerSpec } = await import('../src/swagger.ts');
const { app } = await import('../src/app.ts');
const {
  DEFAULT_POSITION_MAX_AGE_SECONDS,
  MAX_POSITION_MAX_AGE_SECONDS,
  MIN_POSITION_MAX_AGE_SECONDS,
  parseMaxAge,
  toDateAddOffset,
} = await import('../src/train/position-max-age.ts');
const { getTrainPositionQuery } = await import('../src/train/train-queries.ts');
const { fetchTrainPositions } = await import('../src/train/train-service.ts');

const jsonResponse = (status: number, body: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

const position = (overrides: {
  operationalTrainNumber?: string;
  operationalTrainDepartureDate?: string;
  advertisedTrainNumber?: string;
  modifiedTime?: string;
  speed?: number;
} = {}) => ({
  Train: {
    OperationalTrainNumber: overrides.operationalTrainNumber ?? '12345',
    OperationalTrainDepartureDate:
      overrides.operationalTrainDepartureDate ?? '2026-08-27',
    JourneyPlanNumber: '539',
    JourneyPlanDepartureDate: '2026-08-27',
    AdvertisedTrainNumber: overrides.advertisedTrainNumber ?? '539',
  },
  Position: { WGS84: 'POINT (18.05 59.33)' },
  Status: { Active: true },
  ModifiedTime: overrides.modifiedTime ?? '2026-08-27T12:00:00.000Z',
  ...(overrides.speed !== undefined ? { Speed: overrides.speed } : {}),
});

describe('train position maxAge and dedupe', { concurrency: 1 }, () => {
  test('toDateAddOffset builds $dateadd(-HH:MM:SS) from integer seconds', () => {
    assert.equal(toDateAddOffset(30), '$dateadd(-00:00:30)');
    assert.equal(toDateAddOffset(59), '$dateadd(-00:00:59)');
    assert.equal(toDateAddOffset(60), '$dateadd(-00:01:00)');
    assert.equal(toDateAddOffset(90), '$dateadd(-00:01:30)');
    assert.equal(toDateAddOffset(300), '$dateadd(-00:05:00)');
    assert.equal(toDateAddOffset(3599), '$dateadd(-00:59:59)');
    assert.equal(toDateAddOffset(3600), '$dateadd(-01:00:00)');
    assert.equal(
      toDateAddOffset(DEFAULT_POSITION_MAX_AGE_SECONDS),
      '$dateadd(-00:05:00)'
    );
  });

  test('toDateAddOffset rejects non-integers and out-of-range values', () => {
    assert.throws(() => toDateAddOffset(30.5), RangeError);
    assert.throws(() => toDateAddOffset(-1), RangeError);
    assert.throws(() => toDateAddOffset(3601), RangeError);
    assert.throws(() => toDateAddOffset(Number.NaN), RangeError);
    assert.throws(() => toDateAddOffset(Number.POSITIVE_INFINITY), RangeError);
  });

  test('parseMaxAge defaults to 5 minutes and accepts 30..3600', () => {
    assert.deepEqual(parseMaxAge(undefined), {
      ok: true,
      seconds: DEFAULT_POSITION_MAX_AGE_SECONDS,
    });
    assert.deepEqual(parseMaxAge('30'), {
      ok: true,
      seconds: MIN_POSITION_MAX_AGE_SECONDS,
    });
    assert.deepEqual(parseMaxAge(300), { ok: true, seconds: 300 });
    assert.deepEqual(parseMaxAge('3600'), {
      ok: true,
      seconds: MAX_POSITION_MAX_AGE_SECONDS,
    });
  });

  test('parseMaxAge rejects non-integers and values outside 30..3600', () => {
    const invalid = [
      'abc',
      '',
      '  ',
      '1.5',
      '29',
      '3601',
      '-30',
      '30.0',
      '1e2',
      true,
      { maxAge: 300 },
      ['300'],
    ];
    for (const value of invalid) {
      const parsed = parseMaxAge(value);
      assert.equal(parsed.ok, false, `expected invalid for ${String(value)}`);
      if (!parsed.ok) {
        assert.match(parsed.error, /maxAge/i);
        assert.match(parsed.error, /30/i);
        assert.match(parsed.error, /3600/i);
      }
    }
  });

  test('bulk query ANDs Status.Active with a default 5-minute ModifiedTime window', () => {
    const xml = stringify({ QUERY: getTrainPositionQuery() });
    assert.match(xml, /<EQ name="Status.Active" value="true"\s*\/>/);
    assert.match(
      xml,
      /<GT name="ModifiedTime" value="\$dateadd\(-00:05:00\)"\s*\/>/
    );
    assert.match(xml, /<AND>/);
  });

  test('bulk query uses a safely built $dateadd string for custom maxAge', () => {
    const xml = stringify({ QUERY: getTrainPositionQuery(90) });
    assert.match(
      xml,
      /<GT name="ModifiedTime" value="\$dateadd\(-00:01:30\)"\s*\/>/
    );
    assert.doesNotMatch(xml, /\$dateadd\(-00:05:00\)/);
    assert.match(xml, /<EQ name="Status.Active" value="true"\s*\/>/);
  });

  test('fetchTrainPositions keeps the latest row per operational train', async () => {
    const positions = await fetchTrainPositions({
      postAllPages: async () => [
        position({
          modifiedTime: '2026-08-27T12:00:00.000Z',
          speed: 80,
        }),
        position({
          modifiedTime: '2026-08-27T12:00:05.000Z',
          speed: 90,
        }),
        position({
          operationalTrainNumber: '12345',
          operationalTrainDepartureDate: '2026-08-26',
          advertisedTrainNumber: '540',
          modifiedTime: '2026-08-27T12:00:06.000Z',
          speed: 40,
        }),
        position({
          operationalTrainNumber: '99999',
          advertisedTrainNumber: '541',
          modifiedTime: '2026-08-27T11:59:00.000Z',
          speed: 10,
        }),
      ],
    });

    assert.equal(positions.length, 3);
    const sameTrain = positions.filter(
      (row) =>
        row.train.operationalTrainNumber === '12345' &&
        row.train.operationalTrainDepartureDate === '2026-08-27'
    );
    assert.equal(sameTrain.length, 1);
    assert.equal(sameTrain[0].modifiedTime, '2026-08-27T12:00:05.000Z');
    assert.equal(sameTrain[0].speed, 90);

    assert.ok(
      positions.some(
        (row) =>
          row.train.operationalTrainNumber === '12345' &&
          row.train.operationalTrainDepartureDate === '2026-08-26' &&
          row.speed === 40
      )
    );
    assert.ok(
      positions.some(
        (row) =>
          row.train.operationalTrainNumber === '99999' && row.speed === 10
      )
    );
  });

  test('fetchTrainPositions prefers a later ModifiedTime even when it arrives first', async () => {
    const positions = await fetchTrainPositions({
      postAllPages: async () => [
        position({
          modifiedTime: '2026-08-27T12:00:10.000Z',
          speed: 100,
        }),
        position({
          modifiedTime: '2026-08-27T12:00:01.000Z',
          speed: 50,
        }),
      ],
    });

    assert.equal(positions.length, 1);
    assert.equal(positions[0].speed, 100);
    assert.equal(positions[0].modifiedTime, '2026-08-27T12:00:10.000Z');
  });

  test('openapi documents maxAge on both position routes', () => {
    const spec = swaggerSpec as {
      components?: {
        parameters?: {
          TrainPositionMaxAge?: {
            name?: string;
            schema?: {
              type?: string;
              minimum?: number;
              maximum?: number;
              default?: number;
            };
          };
        };
      };
      paths?: Record<
        string,
        {
          get?: {
            parameters?: unknown[];
            responses?: Record<string, unknown>;
          };
        }
      >;
    };

    const param = spec.components?.parameters?.TrainPositionMaxAge;
    assert.equal(param?.name, 'maxAge');
    assert.equal(param?.schema?.type, 'integer');
    assert.equal(param?.schema?.minimum, 30);
    assert.equal(param?.schema?.maximum, 3600);
    assert.equal(param?.schema?.default, 300);

    for (const path of ['/api/train/position', '/api/positions']) {
      const get = spec.paths?.[path]?.get;
      assert.ok(get, `missing OpenAPI path ${path}`);
      assert.ok(get?.responses?.['200']);
      assert.ok(get?.responses?.['400']);
      const serialized = JSON.stringify(get);
      assert.match(serialized, /TrainPositionMaxAge/);
      assert.doesNotMatch(serialized, /no 59-second/);
    }
  });

  test('GET /api/train/position and /api/positions reject invalid maxAge with JSON 400', async () => {
    const server = app.listen(0);
    after(() => {
      server.close();
    });
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    for (const url of [
      `${base}/api/train/position?maxAge=abc`,
      `${base}/api/positions?maxAge=29`,
      `${base}/api/positions?maxAge=3601`,
      `${base}/api/train/position?maxAge=30.5`,
    ]) {
      const res = await fetch(url);
      assert.equal(res.status, 400, url);
      assert.match(res.headers.get('content-type') ?? '', /json/);
      const body = (await res.json()) as { error: string };
      assert.equal(typeof body.error, 'string');
      assert.match(body.error, /maxAge/i);
    }
  });

  test('GET position routes forward maxAge into the Trafikverket dateadd filter', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    const bodies: string[] = [];
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (!target.includes('api.trafikinfo.trafikverket.se')) {
        return originalFetch(url as RequestInfo, init);
      }
      const body = String(init?.body ?? '');
      bodies.push(body);
      if (body.includes('objecttype="TrainPosition"')) {
        return jsonResponse(200, {
          RESPONSE: { RESULT: [{ TrainPosition: [] }] },
        });
      }
      if (body.includes('objecttype="TrainAnnouncement"')) {
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

    const custom = await fetch(`${base}/api/train/position?maxAge=90`);
    assert.equal(custom.status, 200);
    assert.deepEqual(await custom.json(), []);
    const customBody = bodies.find((body) =>
      body.includes('objecttype="TrainPosition"')
    );
    assert.ok(customBody);
    assert.match(
      customBody ?? '',
      /<GT name="ModifiedTime" value="\$dateadd\(-00:01:30\)"\s*\/>/
    );
    assert.match(customBody ?? '', /<EQ name="Status.Active" value="true"\s*\/>/);

    bodies.length = 0;
    const alias = await fetch(`${base}/api/positions`);
    assert.equal(alias.status, 200);
    const defaultBody = bodies.find((body) =>
      body.includes('objecttype="TrainPosition"')
    );
    assert.ok(defaultBody);
    assert.match(
      defaultBody ?? '',
      /<GT name="ModifiedTime" value="\$dateadd\(-00:05:00\)"\s*\/>/
    );
  });
});
