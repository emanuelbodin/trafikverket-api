import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { Writable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import express from 'express';

process.env.TRAFIKVERKET_API_KEY ??= 'test-key';

const {
  createLogger,
  createRequestLoggingMiddleware,
  logContext,
  resolveLogLevel,
} = await import('../src/logger.ts');

const collectJson = () => {
  const lines: Record<string, unknown>[] = [];
  const dest = new Writable({
    write(chunk, _enc, cb) {
      const text = String(chunk).trim();
      if (text) {
        for (const line of text.split('\n')) {
          lines.push(JSON.parse(line) as Record<string, unknown>);
        }
      }
      cb();
    },
  });
  return { dest, lines };
};

describe('structured logging', () => {
  test('resolveLogLevel falls back to info for unknown values', () => {
    assert.equal(resolveLogLevel('debug'), 'debug');
    assert.equal(resolveLogLevel('nope'), 'info');
  });

  test('writes JSON with severity, numeric level, and request context', () => {
    const { dest, lines } = collectJson();
    const log = createLogger({ level: 'info', dest, lokiUrl: '' });
    logContext.run({ requestId: 'req-1' }, () => {
      log.info({ entity: 'TrainAnnouncement' }, 'page truncated');
    });

    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.level, 30);
    assert.equal(lines[0]?.severity, 'info');
    assert.equal(lines[0]?.msg, 'page truncated');
    assert.equal(lines[0]?.service, 'trafikverket-api');
    assert.equal(lines[0]?.requestId, 'req-1');
    assert.equal(lines[0]?.entity, 'TrainAnnouncement');
    assert.deepEqual(lines[0]?.meta, { requestId: 'req-1' });
    assert.equal(typeof lines[0]?.time, 'number');
  });

  test('redacts API key fields', () => {
    const { dest, lines } = collectJson();
    const log = createLogger({ level: 'info', dest, lokiUrl: '' });
    log.info(
      {
        trafikverketApiKey: 'super-secret',
        nested: { authenticationkey: 'also-secret' },
      },
      'should not leak'
    );

    assert.equal(lines[0]?.trafikverketApiKey, '[Redacted]');
    const nested = lines[0]?.nested as { authenticationkey?: string };
    assert.equal(nested.authenticationkey, '[Redacted]');
    const dumped = JSON.stringify(lines[0]);
    assert.equal(dumped.includes('super-secret'), false);
    assert.equal(dumped.includes('also-secret'), false);
  });

  test('serializes Error as err.message and err.stack', () => {
    const { dest, lines } = collectJson();
    const log = createLogger({ level: 'error', dest, lokiUrl: '' });
    log.error({ err: new Error('upstream failed') }, 'GET failed');

    const err = lines[0]?.err as { message?: string; stack?: string };
    assert.equal(lines[0]?.msg, 'GET failed');
    assert.equal(err.message, 'upstream failed');
    assert.match(err.stack ?? '', /upstream failed/);
  });

  test('request middleware logs API routes with X-Request-Id and skips ops paths', async () => {
    const { dest, lines } = collectJson();
    const log = createLogger({ level: 'info', dest, lokiUrl: '' });
    const app = express();
    app.use(createRequestLoggingMiddleware(log));
    app.get('/health', (_req, res) => res.send('OK'));
    app.get('/metrics', (_req, res) => res.send('#'));
    app.get('/api/stations', (_req, res) => res.json([]));

    const server = app.listen(0);
    after(() => {
      server.close();
    });
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const { port } = server.address() as AddressInfo;

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);

    const metrics = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.equal(metrics.status, 200);

    const incomingId = '11111111-1111-4111-8111-111111111111';
    const api = await fetch(`http://127.0.0.1:${port}/api/stations`, {
      headers: { 'X-Request-Id': incomingId },
    });
    assert.equal(api.status, 200);
    assert.equal(api.headers.get('x-request-id'), incomingId);

    const msgs = lines.map((line) => line.msg);
    assert.equal(
      msgs.some((msg) => typeof msg === 'string' && msg.includes('/health')),
      false
    );
    assert.equal(
      msgs.some((msg) => typeof msg === 'string' && msg.includes('/metrics')),
      false
    );

    const requestLog = lines.find(
      (line) => line.msg === 'GET /api/stations 200'
    );
    assert.ok(requestLog);
    assert.equal(requestLog.requestId, incomingId);
    assert.equal(requestLog.level, 30);
    assert.equal(requestLog.severity, 'info');
  });
});
