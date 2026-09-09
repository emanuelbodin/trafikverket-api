import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';

process.env.TRAFIKVERKET_API_KEY ??= 'test-key';

const { app } = await import('../src/app.ts');
const { swaggerSpec } = await import('../src/swagger.ts');

describe('prometheus metrics', { concurrency: 1 }, () => {
  test('GET /metrics exposes process and HTTP instruments', async () => {
    const server = app.listen(0);
    after(() => {
      server.close();
    });
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const { port } = server.address() as AddressInfo;

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);

    const res = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/plain/);
    const body = await res.text();
    assert.match(body, /process_cpu_user_seconds_total/);
    assert.match(body, /http_requests_total/);
    assert.match(body, /http_request_duration_seconds/);
    assert.match(body, /trafikverket_requests_total/);
    assert.match(body, /route="\/health"/);
  });

  test('openapi documents GET /metrics', () => {
    const spec = swaggerSpec as {
      paths?: Record<string, { get?: { summary?: string } }>;
    };
    assert.equal(spec.paths?.['/metrics']?.get?.summary, 'Prometheus metrics');
  });
});
