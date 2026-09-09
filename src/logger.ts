import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import type { DestinationStream, Logger, LoggerOptions } from 'pino';
import { pinoHttp } from 'pino-http';
import type { LokiOptions } from 'pino-loki';
import type { NextFunction, Request, Response } from 'express';
import config from './config.js';

export type LogStore = {
  requestId: string;
};

export const logContext = new AsyncLocalStorage<LogStore>();

const PINO_LEVELS = new Set([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);

const redactPaths = [
  'trafikverketApiKey',
  'authenticationkey',
  '*.authenticationkey',
  '*.Authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
];

const loggerOptions = (level: string): LoggerOptions => ({
  level,
  base: {
    service: 'trafikverket-api',
  },
  messageKey: 'msg',
  redact: { paths: redactPaths, censor: '[Redacted]' },
  formatters: {
    level(label, number) {
      return { level: number, severity: label };
    },
  },
  mixin() {
    const ctx = logContext.getStore();
    if (!ctx) return {};
    return {
      requestId: ctx.requestId,
      meta: { requestId: ctx.requestId },
    };
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

export const resolveLogLevel = (raw: string | undefined): string => {
  const level = (raw ?? 'info').toLowerCase();
  return PINO_LEVELS.has(level) ? level : 'info';
};

export type CreateLoggerOptions = {
  level?: string;
  dest?: DestinationStream;
  lokiUrl?: string;
};

export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
  const level = resolveLogLevel(options.level ?? config.logLevel);
  const opts = loggerOptions(level);
  const lokiUrl = options.lokiUrl ?? config.lokiUrl;

  if (options.dest) {
    return pino(opts, options.dest);
  }

  if (lokiUrl && level !== 'silent') {
    return pino(
      opts,
      pino.transport({
        targets: [
          { target: 'pino/file', options: { destination: 1 } },
          {
            target: 'pino-loki',
            options: {
              host: lokiUrl,
              batching: { interval: 5 },
              labels: { service: 'trafikverket-api' },
              structuredMetaKey: 'meta',
              silenceErrors: false,
            } satisfies LokiOptions,
          },
        ],
      })
    );
  }

  return pino(opts);
};

export const logger = createLogger();

export const getLogger = (): Logger => logger;

export const requestIdFrom = (req: IncomingMessage): string => {
  const header = req.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return randomUUID();
};

const isOpsPath = (url: string | undefined): boolean => {
  const path = url?.split('?')[0];
  return path === '/health' || path === '/metrics';
};

export const createRequestLoggingMiddleware = (log: Logger = logger) => {
  const httpLogger = pinoHttp({
    logger: log,
    quietReqLogger: true,
    genReqId: (req) => logContext.getStore()?.requestId ?? requestIdFrom(req),
    autoLogging: {
      ignore: (req) => isOpsPath(req.url),
    },
    customLogLevel: (
      _req: IncomingMessage,
      res: ServerResponse,
      err?: Error
    ) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url?.split('?')[0] ?? ''} ${res.statusCode}`,
    customErrorMessage: (req, res) =>
      `${req.method} ${req.url?.split('?')[0] ?? ''} ${res.statusCode}`,
    customProps: (req) => ({
      requestId: req.id,
      meta: { requestId: String(req.id) },
    }),
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = requestIdFrom(req);
    res.setHeader('X-Request-Id', requestId);
    logContext.run({ requestId }, () => {
      httpLogger(req, res, next);
    });
  };
};

export const requestLoggingMiddleware = createRequestLoggingMiddleware();

export const logRouteError = (
  req: { log?: Logger },
  err: unknown,
  message: string
): void => {
  const log = req.log ?? getLogger();
  log.error({ err }, message);
};

export const flushLogger = (): void => {
  logger.flush();
};
