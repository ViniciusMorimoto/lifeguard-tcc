import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import { assertLoginAllowed, registerLoginFailure } from './login-rate-limit.js';

test('bloqueia o login depois de cinco tentativas incorretas', () => {
  const request = { ip: '203.0.113.10' } as Request;
  const email = 'limite@lifeguard.test';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.doesNotThrow(() => assertLoginAllowed(request, email));
    registerLoginFailure(request, email);
  }

  assert.throws(
    () => assertLoginAllowed(request, email),
    (error: unknown) => (
      typeof error === 'object'
      && error !== null
      && 'status' in error
      && error.status === 429
      && 'code' in error
      && error.code === 'LOGIN_RATE_LIMITED'
    ),
  );
});
