import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http-error.js';
import { clearRateLimitsForTests, createRateLimit } from './rate-limit.js';

test('rate limit permite o limite configurado e bloqueia a tentativa seguinte', () => {
  clearRateLimitsForTests();
  const middleware = createRateLimit({ windowMs: 60_000, max: 2, prefix: 'test' });
  const request = { ip: '127.0.0.1', socket: {} } as Request;
  const headers = new Map<string, string>();
  const response = { setHeader: (name: string, value: string) => headers.set(name, value) } as unknown as Response;
  const errors: unknown[] = [];
  const next = ((error?: unknown) => errors.push(error)) as NextFunction;

  middleware(request, response, next);
  middleware(request, response, next);
  middleware(request, response, next);

  assert.equal(errors[0], undefined);
  assert.equal(errors[1], undefined);
  assert.ok(errors[2] instanceof HttpError);
  assert.equal((errors[2] as HttpError).status, 429);
  assert.ok(headers.has('Retry-After'));
});
