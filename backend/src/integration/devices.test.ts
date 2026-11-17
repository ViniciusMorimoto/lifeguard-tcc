import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';

test('ESP32: provisioning, isolation, deduplication, alarms, caregiver queue and revocation', async () => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/missing').pathname, /_test$/);
  process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.SMTP_PASSWORD = '';
  const { app } = await import('../app.js');
  const { prisma } = await import('../lib/prisma.js');
  const { dispatchDeviceAlerts } = await import('../services/device-alerts.js');
  const { clearRateLimitsForTests } = await import('../middleware/rate-limit.js');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const ids: string[] = [];
  async function request(path: string, method = 'GET', token?: string, body?: object) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
  async function account(tipo: 'idoso' | 'cuidador') {
    const result = await request('/auth/cadastro', 'POST', undefined, {
      nome: 'Teste dispositivo', email: `${randomUUID()}@example.invalid`, senha: randomBytes(18).toString('hex') + 'aA1!',
      telefone: '+5511999999999', genero: 'prefiro_nao_informar', tipo, aceitouTermos: true, aceitouPrivacidade: true,
    });
    assert.equal(result.status, 201); ids.push(result.data.usuario.id); return result.data;
  }
  try {
    const patient = await account('idoso'); const caregiver = await account('cuidador'); const stranger = await account('idoso');
    await prisma.caregiverElderLink.create({ data: { elderId: patient.usuario.id, caregiverId: caregiver.usuario.id } });
    assert.equal((await request('/dispositivos/me')).status, 401);
    assert.equal((await request('/dispositivos/provisionar', 'POST', caregiver.token, { nome: 'ESP32' })).status, 403);
    assert.equal((await request('/dispositivos/me', 'GET', patient.token)).data.dispositivo, null);
    const provision = await request('/dispositivos/provisionar', 'POST', patient.token, { nome: 'ESP32 teste' });
    assert.equal(provision.status, 201);
    const credential = provision.data.credencial as string;
    const deviceId = provision.data.dispositivo.id;
    const stored = await prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    assert.notEqual(stored.credentialHash, credential.split('.')[1]);
    const status = await request('/dispositivos/me', 'GET', patient.token);
    assert.equal(status.data.dispositivo.conectado, false);
    assert.ok(!JSON.stringify(status.data).includes('credentialHash'));
    assert.equal((await request('/dispositivos/me', 'GET', stranger.token)).data.dispositivo, null);
    let sequence = 0; const epoch = Date.now() - 100_000;
    const sample = (heartRate = 75, contactDetected = true) => ({ sampleId: randomUUID(), timestamp: new Date(epoch + sequence++ * 5000).toISOString(), heartRate, temperature: 36.5, contactDetected, signalQuality: 'GOOD' });
    const first = sample();
    assert.equal((await request('/dispositivos/leituras', 'POST', patient.token, first)).status, 401);
    assert.equal((await request('/dispositivos/leituras', 'POST', credential, { ...first, elderId: stranger.usuario.id })).status, 400);
    const concurrent = await Promise.all([request('/dispositivos/leituras', 'POST', credential, first), request('/dispositivos/leituras', 'POST', credential, first)]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 201]);
    assert.equal(await prisma.reading.count({ where: { deviceId } }), 1);
    assert.equal((await request('/dispositivos/leituras', 'POST', credential, { ...first, heartRate: 90 })).status, 409);
    assert.equal((await request('/dispositivos/leituras', 'POST', credential, { ...sample(), timestamp: '2000-01-01T00:00:00.000Z' })).data.codigo, 'INVALID_SAMPLE_TIME');
    assert.equal((await request('/dispositivos/leituras', 'POST', credential, { ...sample(), timestamp: first.timestamp })).data.codigo, 'OUT_OF_ORDER_SAMPLE');
    const noContact = await request('/dispositivos/leituras', 'POST', credential, sample(220, false));
    assert.equal(noContact.status, 201); assert.equal(noContact.data.valida, false);
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id } }), 0);
    for (let i = 0; i < 3; i++) assert.equal((await request('/dispositivos/leituras', 'POST', credential, sample(140))).status, 201);
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id } }), 1);
    assert.equal((await request('/dispositivos/leituras', 'POST', credential, sample(140))).status, 201);
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id } }), 1);
    const recipients: string[][] = [];
    await dispatchDeviceAlerts(async (userIds) => { recipients.push(userIds); return userIds.length; });
    await dispatchDeviceAlerts(async () => { assert.fail('Queue must not resend a completed job'); });
    assert.deepEqual(recipients, [[caregiver.usuario.id]]);
    for (let i = 0; i < 3; i++) assert.equal((await request('/dispositivos/leituras', 'POST', credential, sample())).status, 201);
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id, status: 'RESOLVED' } }), 1);
    for (let i = 0; i < 3; i++) assert.equal((await request('/dispositivos/leituras', 'POST', credential, sample(140))).status, 201);
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id } }), 1, 'cooldown blocks another episode within 10min');
    assert.equal((await request('/dispositivos/me', 'GET', patient.token)).data.dispositivo.conectado, true);
    const secondDevice = await request('/dispositivos/provisionar', 'POST', patient.token, { nome: 'Substituto' });
    assert.equal(secondDevice.status, 409, 'a patient cannot provision a second active device');
    assert.equal((await request('/dispositivos/leituras', 'POST', credential, first)).status, 200, 'the current device remains active when another is rejected');
    assert.equal((await request('/dispositivos/me', 'DELETE', patient.token)).status, 204);
    assert.equal((await request('/dispositivos/leituras', 'POST', credential, first)).status, 401);
    const replacement = await request('/dispositivos/provisionar', 'POST', patient.token, { nome: 'Substituto' });
    assert.equal(replacement.status, 201);
    assert.equal((await request('/dispositivos/leituras', 'POST', credential, first)).status, 401);
    assert.equal((await request('/dispositivos/me', 'DELETE', patient.token)).status, 204);
    assert.equal((await request('/dispositivos/leituras', 'POST', replacement.data.credencial, first)).status, 401);
    assert.ok((await request(`/idosos/${patient.usuario.id}/leituras`, 'GET', patient.token)).data.leituras.length > 0, 'history is preserved after revocation');
    assert.equal((await request(`/idosos/${patient.usuario.id}/leituras`, 'GET', stranger.token)).status, 403);
    clearRateLimitsForTests();
    assert.equal((await request('/dispositivos/me/simular', 'POST', caregiver.token, { cenario: 'normal' })).status, 403);
    assert.equal((await request('/dispositivos/me/simular', 'POST', stranger.token, { cenario: 'normal' })).status, 409);
    const demo = await request('/dispositivos/provisionar', 'POST', patient.token, { nome: 'VISIT', modo: 'simulador' });
    assert.equal(demo.status, 201); assert.equal(demo.data.credencial, null);
    assert.equal(demo.data.dispositivo.isSimulator, true);
    assert.equal((await request('/dispositivos/me/simular', 'POST', patient.token, { cenario: 'alto', elderId: stranger.usuario.id })).status, 400);
    for (let i = 0; i < 3; i++) {
      // Shift earlier test samples only; avoid wall-clock sleeps in the suite.
      await prisma.reading.updateMany({ where: { deviceId: demo.data.dispositivo.id }, data: { timestamp: new Date(Date.now() - (i === 1 ? 10_000 : 5_000)) } });
      if (i === 2) {
        const previous = await prisma.reading.findMany({ where: { deviceId: demo.data.dispositivo.id }, orderBy: { id: 'asc' } });
        await prisma.reading.update({ where: { id: previous[0]!.id }, data: { timestamp: new Date(Date.now() - 10_000) } });
      }
      assert.equal((await request('/dispositivos/me/simular', 'POST', patient.token, { cenario: 'alto' })).status, 201);
    }
    assert.equal(await prisma.reading.count({ where: { deviceId: demo.data.dispositivo.id, source: 'SIMULATOR' } }), 3);
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id, message: { startsWith: '[SIMULAÇÃO]' } } }), 1);
    await dispatchDeviceAlerts(async (users, message) => {
      assert.deepEqual(users, [caregiver.usuario.id]);
      assert.equal(message.title, 'Demonstração LifeGuard'); return users.length;
    });
    await prisma.reading.updateMany({ where: { deviceId: demo.data.dispositivo.id }, data: { timestamp: new Date(Date.now() - 1000) } });
    assert.equal((await request('/dispositivos/me/simular', 'POST', patient.token, { cenario: 'sem_contato' })).data.valida, false);
    async function sendDemoSequence(cenario: 'normal' | 'alto') {
      await prisma.reading.updateMany({ where: { deviceId: demo.data.dispositivo.id }, data: { timestamp: new Date(Date.now() - 100_000) } });
      const created: bigint[] = [];
      for (let i = 0; i < 3; i++) {
        if (i === 1) await prisma.reading.update({ where: { id: created[0]! }, data: { timestamp: new Date(Date.now() - 5_000) } });
        if (i === 2) {
          await prisma.reading.update({ where: { id: created[0]! }, data: { timestamp: new Date(Date.now() - 10_000) } });
          await prisma.reading.update({ where: { id: created[1]! }, data: { timestamp: new Date(Date.now() - 5_000) } });
        }
        const result = await request('/dispositivos/me/simular', 'POST', patient.token, { cenario });
        assert.equal(result.status, 201);
        created.push(BigInt(result.data.id));
      }
    }
    const activeDemoAlert = await prisma.alert.findFirstOrThrow({ where: { elderId: patient.usuario.id, message: { startsWith: '[SIMULAÇÃO]' } } });
    assert.equal((await request('/alertas', 'GET', caregiver.token)).data.alertas.find((item: { id: string }) => item.id === activeDemoAlert.id).status, 'novo');
    const resolution = await request(`/alertas/${activeDemoAlert.id}`, 'PATCH', caregiver.token, { status: 'resolvido' });
    assert.equal(resolution.status, 200);
    assert.equal(resolution.data.alerta.status, 'resolvido');
    assert.equal((await request('/alertas', 'GET', caregiver.token)).data.alertas.find((item: { id: string }) => item.id === activeDemoAlert.id).status, 'resolvido', 'resolved alerts stay resolved when refreshed');
    await sendDemoSequence('alto');
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id, message: { startsWith: '[SIMULAÇÃO]' } } }), 1, 'manual resolution must not rearm a continuously high signal');
    await sendDemoSequence('normal');
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id, message: { startsWith: '[SIMULAÇÃO]' }, status: 'RESOLVED' } }), 1);
    await sendDemoSequence('alto');
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id, message: { startsWith: '[SIMULAÇÃO]' } } }), 2, 'new simulation episode bypasses real-device cooldown');
    assert.equal(await prisma.alert.count({ where: { elderId: patient.usuario.id, message: { startsWith: '[SIMULAÇÃO]' }, resolvedAt: null } }), 1, 'only one active simulation alert');
    assert.equal((await request(`/idosos/${patient.usuario.id}`, 'GET', caregiver.token)).data.idoso.simulado, true);
    assert.ok((await request(`/idosos/${patient.usuario.id}/leituras`, 'GET', patient.token)).data.leituras.some((item: { origem: string }) => item.origem === 'simulator'));
    clearRateLimitsForTests();
    for (let i = 0; i < 30; i++) assert.equal((await request('/dispositivos/leituras', 'POST', undefined, first)).status, 401);
    assert.equal((await request('/dispositivos/leituras', 'POST', undefined, first)).status, 429);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await new Promise<void>((resolve) => server.close(() => resolve())); await prisma.$disconnect();
  }
});
