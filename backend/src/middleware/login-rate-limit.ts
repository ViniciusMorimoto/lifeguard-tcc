import type { Request } from 'express';
import { HttpError } from '../lib/http-error.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type Attempt = { failures: number; resetAt: number };

const attempts = new Map<string, Attempt>();

function keyFor(req: Request, email: string) {
  return `${req.ip || req.socket.remoteAddress || 'unknown'}:${email}`;
}

function currentAttempt(req: Request, email: string) {
  const key = keyFor(req, email);
  const saved = attempts.get(key);
  if (saved && saved.resetAt > Date.now()) return { key, attempt: saved };
  attempts.delete(key);
  return { key, attempt: null };
}

export function assertLoginAllowed(req: Request, email: string) {
  const { attempt } = currentAttempt(req, email);
  if (attempt && attempt.failures >= MAX_FAILURES) {
    throw new HttpError(429, 'Muitas tentativas incorretas. Aguarde 15 minutos e tente novamente.', 'LOGIN_RATE_LIMITED');
  }
}

export function registerLoginFailure(req: Request, email: string) {
  const { key, attempt } = currentAttempt(req, email);
  attempts.set(key, {
    failures: (attempt?.failures ?? 0) + 1,
    resetAt: attempt?.resetAt ?? Date.now() + WINDOW_MS,
  });
}

export function clearLoginFailures(req: Request, email: string) {
  attempts.delete(keyFor(req, email));
}
