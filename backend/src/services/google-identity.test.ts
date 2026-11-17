import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { createGoogleIdentityVerifier } from './google-identity.js';
import { HttpError } from '../lib/http-error.js';

// Ephemeral test keys only: no Google credentials, network or database required.
const pair = await generateKeyPair('RS256');
const publicKey = await exportJWK(pair.publicKey);
const keys = createLocalJWKSet({ keys: [{ ...publicKey, kid: 'test-key', alg: 'RS256' }] });
const webClientId = 'test-web.apps.googleusercontent.com';
const androidClientId = 'test-android.apps.googleusercontent.com';
const verify = createGoogleIdentityVerifier({ webClientId, androidClientId, keys });
const now = () => Math.floor(Date.now() / 1000);
async function token(overrides: JWTPayload = {}, omit: string[] = []) {
  const claims: JWTPayload = {
    iss: 'https://accounts.google.com', aud: webClientId, sub: 'google-subject-123',
    iat: now(), exp: now() + 3600, email: 'Patient@example.com', email_verified: true,
    ...overrides,
  };
  for (const key of omit) delete claims[key];
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(pair.privateKey);
}
const invalid = (error: unknown) => error instanceof HttpError && error.status === 401 && error.code === 'INVALID_GOOGLE_TOKEN';

test('Google: accepts signed identity and normalizes email, not subject', async () => {
  assert.deepEqual(await verify(await token()), { subject: 'google-subject-123', email: 'patient@example.com' });
});
test('Google: accepts alternate documented issuer and configured Android presenter', async () => {
  assert.equal((await verify(await token({ iss: 'accounts.google.com', azp: androidClientId }))).subject, 'google-subject-123');
});
for (const [label, claims] of Object.entries({
  expired: { exp: now() - 60 },
  future: { iat: now() + 120 },
  stale: { iat: now() - 7200 },
  issuer: { iss: 'https://attacker.example' },
  audience: { aud: 'other-app' },
  multipleAudiences: { aud: [webClientId, 'other-app'] },
  presenter: { azp: 'other-client' },
  unverifiedEmail: { email_verified: false },
  stringVerified: { email_verified: 'true' },
  invalidEmail: { email: 'invalid' },
  emptySubject: { sub: '' },
})) {
  test(`Google: rejects ${label}`, async () => assert.rejects(verify(await token(claims)), invalid));
}
for (const claim of ['sub', 'iat', 'exp', 'email', 'email_verified']) {
  test(`Google: requires ${claim}`, async () => assert.rejects(verify(await token({}, [claim])), invalid));
}
test('Google: rejects malformed and excessive inputs', async () => {
  for (const input of [null, {}, '', 'not-a-jwt', 'a'.repeat(16_385)]) await assert.rejects(verify(input), invalid);
});
test('Google: rejects forged signatures', async () => {
  const attacker = await generateKeyPair('RS256');
  const forged = await new SignJWT({ sub: 'attacker' }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(attacker.privateKey);
  await assert.rejects(verify(forged), invalid);
});
test('Google: rejects symmetric algorithm even with otherwise valid claims', async () => {
  const forged = await new SignJWT({ iss: 'https://accounts.google.com', aud: webClientId, sub: 'attacker', iat: now(), exp: now() + 3600, email: 'a@example.com', email_verified: true })
    .setProtectedHeader({ alg: 'HS256' }).sign(new Uint8Array(32));
  await assert.rejects(verify(forged), invalid);
});
test('Google: fails closed without configured audience', async () => {
  await assert.rejects(createGoogleIdentityVerifier({ keys })(await token()), (error: unknown) =>
    error instanceof HttpError && error.status === 503 && error.code === 'GOOGLE_NOT_CONFIGURED');
});
test('Google: key service failure is retryable and leaks no upstream detail', async () => {
  const unavailable = createGoogleIdentityVerifier({ webClientId, keys: async () => { throw new TypeError('private upstream detail'); } });
  await assert.rejects(unavailable(await token()), (error: unknown) =>
    error instanceof HttpError && error.status === 503 && !error.message.includes('private'));
});
