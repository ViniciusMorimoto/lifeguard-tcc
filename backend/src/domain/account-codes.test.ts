import assert from 'node:assert/strict';
import test from 'node:test';
import { accountCodeMatches, createAccountCode, hashAccountCode } from './account-codes.js';

test('gera um código numérico com seis dígitos', () => {
  assert.match(createAccountCode(), /^\d{6}$/);
});

test('protege e compara o código usando a chave do servidor', () => {
  const hash = hashAccountCode('012345', 'uma-chave-secreta-de-teste');
  assert.equal(accountCodeMatches('012345', hash, 'uma-chave-secreta-de-teste'), true);
  assert.equal(accountCodeMatches('012346', hash, 'uma-chave-secreta-de-teste'), false);
  assert.equal(accountCodeMatches('012345', hash, 'outra-chave'), false);
});
