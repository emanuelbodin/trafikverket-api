import type { NextFunction, Request, Response } from 'express';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from '@prometheus-io/client';

export const register = new Registry();

collectDefaultMetrics({ register });

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

const trafikverketRequestDuration = new Histogram({
  name: 'trafikverket_request_duration_seconds',
  help: 'Duration of Trafikverket API requests in seconds',
  labelNames: ['entity'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

const trafikverketRequestsTotal = new Counter({
  name: 'trafikverket_requests_total',
  help: 'Total Trafikverket API requests',
  labelNames: ['entity', 'result'] as const,
  registers: [register],
});

const routeLabel = (req: Request): string => {
  const path = req.route?.path;
  if (typeof path === 'string') {
    return `${req.baseUrl}${path}`;
  }
  return 'unmatched';
};

export const httpMetricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.path === '/metrics') {
    next();
    return;
  }

  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(res.statusCode),
    };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
};

export const startTrafikverketTimer = (entity: string) =>
  trafikverketRequestDuration.startTimer({ entity });

export const recordTrafikverketResult = (
  entity: string,
  result: 'success' | 'truncated' | 'error'
): void => {
  trafikverketRequestsTotal.inc({ entity, result });
};
