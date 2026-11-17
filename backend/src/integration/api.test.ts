import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';

test('contas, vínculos, isolamento de pacientes e revogação em banco de teste', async (context) => {
  // Never run against a production DB, even if the surrounding .env points there.
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/missing');
  assert.equal(process.env.NODE_ENV, 'test', 'Exige NODE_ENV=test');
  assert.match(url.pathname, /_test$/, 'Exige um banco cujo nome termine em _test');
  process.env.SMTP_HOST = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASSWORD = '';
  const { app } = await import('../app.js');
  const { prisma } = await import('../lib/prisma.js');
  const { env } = await import('../config/env.js');
  const { AccountCodeType } = await import('../generated/prisma/enums.js');
  const { hashAccountCode } = await import('../domain/account-codes.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const ids: string[] = [];
  const senha = randomBytes(20).toString('base64') + 'aA1!';
  async function request(path: string, method = 'GET', token?: string, body?: object) {
    const response = await fetch(base + path, { method, headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
  async function register(tipo: 'idoso' | 'cuidador') {
    const email = `integration-${randomUUID()}@example.invalid`;
    const result = await request('/auth/cadastro', 'POST', undefined, {
      nome: 'Pessoa de teste', email, senha, telefone: '+5511999999999', genero: 'prefiro_nao_informar',
      tipo, aceitouTermos: true, aceitouPrivacidade: true,
    });
    assert.equal(result.status, 201);
    ids.push(result.data.usuario.id);
    return { ...result.data, email };
  }
  try {
    assert.equal((await request('/auth/me')).status, 401);
    const patient = await register('idoso');
    const caregiver = await register('cuidador');
    const stranger = await register('cuidador');
    assert.equal((await request(`/idosos/${patient.usuario.id}`, 'GET', stranger.token)).status, 403);
    const code = await request('/vinculos/codigo', 'POST', patient.token);
    assert.equal(code.status, 201);
    const results = await Promise.all([
      request('/vinculos', 'POST', caregiver.token, { codigo: code.data.codigo }),
      request('/vinculos', 'POST', stranger.token, { codigo: code.data.codigo }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
    const winner = results[0].status === 201 ? caregiver : stranger;
    const loser = results[0].status === 201 ? stranger : caregiver;
    const link = results.find((r) => r.status === 201)!.data.vinculo;
    assert.equal((await request(`/idosos/${patient.usuario.id}`, 'GET', winner.token)).status, 200);
    assert.equal((await request(`/idosos/${patient.usuario.id}`, 'GET', winner.token)).data.idoso.vinculoId, link.id, 'patient detail preserves the link needed for removal');
    assert.equal((await request(`/idosos/${patient.usuario.id}`, 'GET', loser.token)).status, 403);
    assert.equal((await request(`/vinculos/${link.id}`, 'DELETE', loser.token)).status, 403);
    assert.equal((await request(`/vinculos/${link.id}`, 'DELETE', winner.token)).status, 204);
    assert.equal((await request(`/idosos/${patient.usuario.id}`, 'GET', winner.token)).status, 403);
    assert.equal((await request(`/idosos/${patient.usuario.id}/limites`, 'PUT', patient.token, {})).status, 403);
    const second = await request('/auth/login', 'POST', undefined, { email: patient.email, senha });
    assert.equal(second.status, 200);
    const revoked = await request('/auth/sessoes/revogar-outras', 'POST', second.data.token);
    assert.equal(revoked.status, 200);
    assert.equal((await request('/auth/me', 'GET', patient.token)).status, 401);
    assert.equal((await request('/auth/me', 'GET', revoked.data.token)).status, 200);
    const exported = await request('/auth/me/exportacao', 'GET', revoked.data.token);
    assert.equal(exported.status, 200);
    assert.ok(!JSON.stringify(exported.data).includes(senha));
    assert.ok(!JSON.stringify(exported.data).includes(second.data.token));
    const { checkPushReceipts } = await import('../services/push-receipts.js');
    const old = new Date(Date.now() - 20 * 60_000);
    const stale = await prisma.pushToken.create({ data: {
      userId: patient.usuario.id, token: `ExpoPushToken[${randomUUID()}]`, platform: 'android', updatedAt: old,
    } });
    const renewed = await prisma.pushToken.create({ data: {
      userId: patient.usuario.id, token: `ExpoPushToken[${randomUUID()}]`, platform: 'android',
    } });
    await prisma.pushDelivery.createMany({ data: [
      { userId: patient.usuario.id, pushTokenId: stale.id, providerId: 'stale-test', createdAt: old },
      { userId: patient.usuario.id, pushTokenId: renewed.id, providerId: 'renewed-test', createdAt: old },
    ] });
    const mockedFetch = context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: {
      'stale-test': { status: 'error', details: { error: 'DeviceNotRegistered' } },
      'renewed-test': { status: 'error', details: { error: 'DeviceNotRegistered' } },
    } }), { status: 200 }));
    try { await checkPushReceipts(); } finally { mockedFetch.mock.restore(); }
    assert.equal((await prisma.pushToken.findUniqueOrThrow({ where: { id: stale.id } })).active, false);
    assert.equal((await prisma.pushToken.findUniqueOrThrow({ where: { id: renewed.id } })).active, true);
    assert.equal(await prisma.pushDelivery.count({ where: { userId: patient.usuario.id, status: 'failed' } }), 2);
    assert.equal((await request('/notificacoes/entregas', 'GET', loser.token)).data.entregas.length, 0);

    const verificationCode = '654321';
    await prisma.accountCode.create({ data: {
      userId: patient.usuario.id,
      type: AccountCodeType.EMAIL_VERIFICATION,
      codeHash: hashAccountCode(verificationCode, env.JWT_SECRET),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    } });
    const wrongVerification = await request('/auth/email/confirmacao/confirmar', 'POST', revoked.data.token, { codigo: '000000' });
    assert.equal(wrongVerification.status, 400);
    const correctVerification = await request('/auth/email/confirmacao/confirmar', 'POST', revoked.data.token, { codigo: verificationCode });
    assert.equal(correctVerification.status, 200);

    const recoveryCode = '765432';
    await prisma.accountCode.create({ data: {
      userId: patient.usuario.id,
      type: AccountCodeType.PASSWORD_RESET,
      codeHash: hashAccountCode(recoveryCode, env.JWT_SECRET),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    } });
    const unchangedPassword = await request('/auth/senha/recuperacao/confirmar', 'POST', undefined, {
      email: patient.email, codigo: recoveryCode, novaSenha: senha,
    });
    assert.equal(unchangedPassword.status, 400);
    assert.equal(unchangedPassword.data.codigo, 'PASSWORD_UNCHANGED');
  } finally {
    // Delete only accounts created by this test, on the guarded test database.
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
