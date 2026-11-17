import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const ACCOUNT_CODE_DURATION_MS = 15 * 60 * 1000;
export const ACCOUNT_CODE_RESEND_MS = 60 * 1000;
export const ACCOUNT_CODE_MAX_ATTEMPTS = 5;

export function createAccountCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashAccountCode(code: string, secret: string) {
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function accountCodeMatches(code: string, expectedHash: string, secret: string) {
  const actual = Buffer.from(hashAccountCode(code, secret));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
