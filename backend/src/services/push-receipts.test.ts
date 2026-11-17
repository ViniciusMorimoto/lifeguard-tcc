import assert from 'node:assert/strict';
import test from 'node:test';
import { receiptOutcome } from './push-receipts.js';

const now = new Date('2026-09-29T20:00:00Z');
test('comprovante aceito não significa leitura pelo usuário', () => {
  assert.deepEqual(receiptOutcome({ status: 'ok' }, now, now), { status: 'accepted', errorCode: null });
});
test('token inválido preserva o código necessário para desativação', () => {
  assert.deepEqual(receiptOutcome({ status: 'error', details: { error: 'DeviceNotRegistered' } }, now, now), {
    status: 'failed', errorCode: 'DeviceNotRegistered',
  });
});
test('comprovante ausente é aguardado por até 24 horas', () => {
  assert.equal(receiptOutcome(undefined, new Date(now.getTime() - 60 * 60_000), now), null);
  assert.deepEqual(receiptOutcome(undefined, new Date(now.getTime() - 24 * 60 * 60_000), now), {
    status: 'unknown', errorCode: 'ReceiptExpired',
  });
});
