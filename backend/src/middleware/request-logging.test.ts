import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLog, safeErrorFields } from '../lib/logger.js';

test('remove campos sensíveis de logs estruturados', () => {
  const parsed = JSON.parse(formatLog('error', 'test', {
    requestId: 'request-1',
    email: 'paciente@example.com',
    nested: { password: 'Teste123!', token: 'segredo', status: 500 },
    optional: undefined,
  }));

  assert.equal(parsed.email, '[REDACTED]');
  assert.equal(parsed.nested.password, '[REDACTED]');
  assert.equal(parsed.nested.token, '[REDACTED]');
  assert.equal(parsed.nested.status, 500);
  assert.equal(parsed.requestId, 'request-1');
  assert.equal('optional' in parsed, false);
});

test('não inclui mensagem nem stack de erros inesperados', () => {
  const error = Object.assign(new Error('contém dado que não deve ir ao log'), { code: 'P2002' });
  assert.deepEqual(safeErrorFields(error), { errorType: 'Error', errorCode: 'P2002' });
});
