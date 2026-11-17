import { Router } from 'express';
import { z } from 'zod';
import { classifyReading } from '../domain/readings.js';
import { AlertStatus, LinkStatus, UserType } from '../generated/prisma/enums.js';
import { HttpError } from '../lib/http-error.js';
import { aggregateReadingsByInterval } from '../domain/reading-aggregates.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeElderProfile, serializeGender } from '../serializers.js';

const idSchema = z.uuid();
const alertStatusLabels = { NEW: 'novo', SEEN: 'visto', RESOLVED: 'resolvido' } as const;
const limitsSchema = z.object({
  batimentoMin: z.number().int().min(30).max(150),
  batimentoMax: z.number().int().min(50).max(250),
  temperaturaMin: z.number().min(30).max(40),
  temperaturaMax: z.number().min(34).max(45),
}).refine((data) => data.batimentoMin < data.batimentoMax, {
  message: 'O limite mínimo de batimento deve ser menor que o máximo.',
  path: ['batimentoMax'],
}).refine((data) => data.temperaturaMin < data.temperaturaMax, {
  message: 'O limite mínimo de temperatura deve ser menor que o máximo.',
  path: ['temperaturaMax'],
});

export const monitoringRouter = Router();
monitoringRouter.use(requireAuth);

async function assertElderAccess(userId: string, userType: UserType, elderId: string) {
  if (userType === UserType.ELDER && userId === elderId) return;
  if (userType === UserType.CAREGIVER) {
    const link = await prisma.caregiverElderLink.findFirst({
      where: { caregiverId: userId, elderId, status: LinkStatus.ACTIVE },
      select: { id: true },
    });
    if (link) return link.id;
  }
  throw new HttpError(403, 'Você não possui acesso a este paciente.', 'ELDER_ACCESS_DENIED');
}

function serializeLimits(limits: {
  heartRateMinimum: number;
  heartRateMaximum: number;
  temperatureMinimum: number;
  temperatureMaximum: number;
  updatedAt: Date;
  definedBy?: { name: string } | null;
}) {
  return {
    batimentoMin: limits.heartRateMinimum,
    batimentoMax: limits.heartRateMaximum,
    temperaturaMin: limits.temperatureMinimum,
    temperaturaMax: limits.temperatureMaximum,
    atualizadoEm: limits.updatedAt,
    definidoPor: limits.definedBy?.name ?? null,
  };
}

function serializeReading(reading: {
  id: bigint;
  heartRate: number | null;
  temperature: number | null;
  timestamp: Date;
  signalQuality: string;
  contactDetected: boolean;
  valid: boolean;
  invalidReason: string | null;
  source: string;
} | null) {
  if (!reading) return null;
  return {
    id: reading.id.toString(),
    batimento: reading.heartRate,
    temperatura: reading.temperature,
    horario: reading.timestamp,
    qualidadeSinal: reading.signalQuality.toLowerCase(),
    contatoDetectado: reading.contactDetected,
    valida: reading.valid,
    motivoInvalido: reading.invalidReason,
    origem: reading.source.toLowerCase(),
  };
}

monitoringRouter.get('/idosos', async (req, res) => {
  if (req.auth!.type !== UserType.CAREGIVER) {
    throw new HttpError(403, 'Apenas cuidadores possuem uma lista de pacientes.', 'CAREGIVER_ONLY');
  }

  const links = await prisma.caregiverElderLink.findMany({
    where: { caregiverId: req.auth!.userId, status: LinkStatus.ACTIVE },
    include: {
      elder: {
        include: {
          alertLimits: true,
          devices: {
            where: { active: true },
            take: 1,
            include: { readings: { where: { valid: true }, orderBy: { timestamp: 'desc' }, take: 1 } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const idosos = links.map(({ id: linkId, elder }) => {
    const latest = elder.devices[0]?.readings[0] ?? null;
    const limits = elder.alertLimits ?? {
      heartRateMinimum: 50,
      heartRateMaximum: 120,
      temperatureMinimum: 35.5,
      temperatureMaximum: 37.8,
    };
    return {
      id: elder.id,
      vinculoId: linkId,
      nome: elder.name,
      telefone: elder.phone,
      foto: elder.profilePhoto,
      status: classifyReading(latest, limits),
      simulado: elder.devices[0]?.isSimulator ?? false,
      ultimaLeitura: serializeReading(latest),
    };
  });

  res.json({ idosos });
});

monitoringRouter.get('/idosos/:idosoId', async (req, res) => {
  const elderId = idSchema.parse(req.params.idosoId);
  const linkId = await assertElderAccess(req.auth!.userId, req.auth!.type, elderId);
  const elder = await prisma.user.findFirst({
    where: { id: elderId, type: UserType.ELDER },
    include: {
      elderProfile: true,
      alertLimits: { include: { definedBy: { select: { name: true } } } },
      devices: {
        where: { active: true },
        take: 1,
        include: { readings: { where: { valid: true }, orderBy: { timestamp: 'desc' }, take: 1 } },
      },
    },
  });
  if (!elder) throw new HttpError(404, 'Paciente não encontrado.', 'ELDER_NOT_FOUND');

  const latest = elder.devices[0]?.readings[0] ?? null;
  const limits = elder.alertLimits;
  res.json({
    idoso: {
      id: elder.id,
      vinculoId: linkId,
      nome: elder.name,
      telefone: elder.phone,
      foto: elder.profilePhoto,
      genero: serializeGender(elder.gender),
      perfilIdoso: serializeElderProfile(elder.elderProfile),
      contatoEmergencia: elder.elderProfile
        ? {
            nome: elder.elderProfile.emergencyContactName,
            telefone: elder.elderProfile.emergencyContactPhone,
          }
        : null,
      status: limits ? classifyReading(latest, limits) : 'sem_sinal',
      simulado: elder.devices[0]?.isSimulator ?? false,
      ultimaLeitura: serializeReading(latest),
      limites: limits ? serializeLimits(limits) : null,
    },
  });
});

monitoringRouter.get('/idosos/:idosoId/leituras', async (req, res) => {
  const elderId = idSchema.parse(req.params.idosoId);
  const query = z.object({ limite: z.coerce.number().int().min(1).max(500).default(100), resolucao: z.enum(['10s', '1h']).default('1h') }).parse(req.query);
  await assertElderAccess(req.auth!.userId, req.auth!.type, elderId);
  if (query.resolucao === '10s') {
    const since = new Date(Date.now() - 5 * 60_000);
    const readings = await prisma.reading.findMany({
      where: { device: { elderId }, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
      take: 120,
    });
    const buckets = aggregateReadingsByInterval(readings, 10_000);
    res.json({ leituras: buckets.slice(-30).map((bucket) => ({
      id: bucket.timestamp.toISOString(),
      batimento: bucket.heartRateAverage === null ? null : Math.round(bucket.heartRateAverage),
      batimentoMinimo: bucket.heartRateMinimum,
      batimentoMaximo: bucket.heartRateMaximum,
      temperatura: bucket.temperatureAverage,
      temperaturaMinima: bucket.temperatureMinimum,
      temperaturaMaxima: bucket.temperatureMaximum,
      horario: bucket.timestamp,
      qualidadeSinal: bucket.sampleCount ? 'good' : 'no_contact',
      contatoDetectado: bucket.sampleCount > 0,
      valida: bucket.sampleCount > 0,
      motivoInvalido: null,
      origem: 'aggregate',
    })) });
    return;
  }
  const hourlyReadings = await prisma.$queryRaw<Array<{
    horario: Date;
    batimento: number | null;
    batimentoMinimo: number | null;
    batimentoMaximo: number | null;
    temperatura: number | null;
    temperaturaMinima: number | null;
    temperaturaMaxima: number | null;
    quantidade: bigint;
  }>>`
    SELECT
      date_trunc('hour', reading."timestamp") AS horario,
      AVG(reading."heartRate")::double precision AS batimento,
      MIN(reading."heartRate") AS "batimentoMinimo",
      MAX(reading."heartRate") AS "batimentoMaximo",
      AVG(reading."temperature") AS temperatura,
      MIN(reading."temperature") AS "temperaturaMinima",
      MAX(reading."temperature") AS "temperaturaMaxima",
      COUNT(*) AS quantidade
    FROM "Reading" reading
    INNER JOIN "Device" device ON device.id = reading."deviceId"
    WHERE device."elderId" = ${elderId}::uuid
      AND reading.valid = true
      AND reading."timestamp" >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - (${query.limite} * INTERVAL '1 hour')
    GROUP BY date_trunc('hour', reading."timestamp")
    ORDER BY horario DESC
    LIMIT ${query.limite}
  `;
  res.json({ leituras: hourlyReadings.map((item) => ({
    id: item.horario.toISOString(),
    batimento: item.batimento === null ? null : Math.round(item.batimento),
    batimentoMinimo: item.batimentoMinimo,
    batimentoMaximo: item.batimentoMaximo,
    temperatura: item.temperatura,
    temperaturaMinima: item.temperaturaMinima,
    temperaturaMaxima: item.temperaturaMaxima,
    horario: item.horario,
    qualidadeSinal: 'good',
    contatoDetectado: true,
    valida: Number(item.quantidade) > 0,
    motivoInvalido: null,
    origem: 'aggregate',
  })) });
});

monitoringRouter.get('/idosos/:idosoId/alteracoes', async (req, res) => {
  const elderId = idSchema.parse(req.params.idosoId);
  await assertElderAccess(req.auth!.userId, req.auth!.type, elderId);
  const changes = await prisma.patientChangeLog.findMany({
    where: { patientId: elderId },
    include: { changedBy: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({
    alteracoes: changes.map((change) => ({
      id: change.id,
      categoria: change.category === 'ALERT_LIMITS' ? 'limites' : 'perfil',
      campos: change.changedFields,
      alteradoEm: change.createdAt,
      alteradoPor: change.changedBy
        ? {
            id: change.changedBy.id,
            nome: change.changedBy.name,
            tipo: change.changedBy.type === UserType.ELDER ? 'paciente' : 'cuidador',
          }
        : null,
    })),
  });
});

monitoringRouter.get('/idosos/:idosoId/limites', async (req, res) => {
  const elderId = idSchema.parse(req.params.idosoId);
  await assertElderAccess(req.auth!.userId, req.auth!.type, elderId);
  const limits = await prisma.alertLimit.findUnique({
    where: { elderId },
    include: { definedBy: { select: { name: true } } },
  });
  if (!limits) throw new HttpError(404, 'Limites não encontrados.', 'LIMITS_NOT_FOUND');
  res.json({ limites: serializeLimits(limits) });
});

monitoringRouter.put('/idosos/:idosoId/limites', async (req, res) => {
  if (req.auth!.type !== UserType.CAREGIVER) {
    throw new HttpError(403, 'Somente cuidadores podem alterar limites.', 'CAREGIVER_ONLY');
  }
  const elderId = idSchema.parse(req.params.idosoId);
  const input = limitsSchema.parse(req.body);
  await assertElderAccess(req.auth!.userId, req.auth!.type, elderId);
  const currentLimits = await prisma.alertLimit.findUnique({ where: { elderId } });
  const changedFields: string[] = [];
  if (currentLimits?.heartRateMinimum !== input.batimentoMin) changedFields.push('batimento_minimo');
  if (currentLimits?.heartRateMaximum !== input.batimentoMax) changedFields.push('batimento_maximo');
  if (currentLimits?.temperatureMinimum !== input.temperaturaMin) changedFields.push('temperatura_minima');
  if (currentLimits?.temperatureMaximum !== input.temperaturaMax) changedFields.push('temperatura_maxima');

  const limits = await prisma.$transaction(async (tx) => {
    const updated = await tx.alertLimit.upsert({
      where: { elderId },
      create: {
        elderId,
        heartRateMinimum: input.batimentoMin,
        heartRateMaximum: input.batimentoMax,
        temperatureMinimum: input.temperaturaMin,
        temperatureMaximum: input.temperaturaMax,
        definedById: req.auth!.userId,
      },
      update: {
        heartRateMinimum: input.batimentoMin,
        heartRateMaximum: input.batimentoMax,
        temperatureMinimum: input.temperaturaMin,
        temperatureMaximum: input.temperaturaMax,
        definedById: req.auth!.userId,
      },
      include: { definedBy: { select: { name: true } } },
    });
    if (changedFields.length > 0) {
      await tx.patientChangeLog.create({
        data: {
          patientId: elderId,
          changedById: req.auth!.userId,
          category: 'ALERT_LIMITS',
          changedFields,
        },
      });
    }
    return updated;
  });
  res.json({ limites: serializeLimits(limits) });
});

monitoringRouter.get('/alertas', async (req, res) => {
  const elderFilter = req.auth!.type === UserType.ELDER
    ? { elderId: req.auth!.userId }
    : { elder: { elderLinks: { some: { caregiverId: req.auth!.userId, status: LinkStatus.ACTIVE } } } };
  const alerts = await prisma.alert.findMany({
    where: elderFilter,
    include: { elder: { select: { name: true } } },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });
  res.json({
    alertas: alerts.map((alert) => ({
      id: alert.id,
      idosoId: alert.elderId,
      idosoNome: alert.elder.name,
      tipo: {
        HEART_RATE: 'batimento',
        TEMPERATURE: 'temperatura',
        DEVICE_OFFLINE: 'dispositivo_offline',
        SIGNAL_LOST: 'sinal_perdido',
      }[alert.type],
      valor: alert.measuredValue,
      mensagem: alert.message,
      horario: alert.timestamp,
      status: alertStatusLabels[alert.status],
    })),
  });
});

monitoringRouter.patch('/alertas/:alertaId', async (req, res) => {
  const alertId = idSchema.parse(req.params.alertaId);
  const input = z.object({ status: z.enum(['novo', 'visto', 'resolvido']) }).parse(req.body);
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) throw new HttpError(404, 'Alerta não encontrado.', 'ALERT_NOT_FOUND');
  await assertElderAccess(req.auth!.userId, req.auth!.type, alert.elderId);
  const statusMap = { novo: AlertStatus.NEW, visto: AlertStatus.SEEN, resolvido: AlertStatus.RESOLVED } as const;
  const updated = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: statusMap[input.status],
      resolvedAt: input.status === 'resolvido' ? new Date() : null,
    },
  });
  res.json({ alerta: { id: updated.id, status: alertStatusLabels[updated.status] } });
});
