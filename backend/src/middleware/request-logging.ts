import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { log } from '../lib/logger.js';

function routeName(req: Request) {
  if (req.route?.path) return `${req.baseUrl}${String(req.route.path)}`;
  return req.path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d{6,}(?=\/|$)/g, '/:value');
}

export const requestLogging: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();
  const requestId = randomUUID();
  let logged = false;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  function finish(aborted = false) {
    if (logged) return;
    logged = true;
    if (!aborted && req.path === '/health' && res.statusCode < 400) return;
    const status = aborted ? 499 : res.statusCode;
    log(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', 'http_request', {
      requestId,
      method: req.method,
      route: routeName(req),
      status,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      actorType: req.auth?.type,
      aborted,
    });
  }

  res.once('finish', () => finish());
  res.once('close', () => finish(!res.writableFinished));
  next();
};
