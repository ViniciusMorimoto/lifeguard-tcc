import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { LinkStatus, UserType } from '../generated/prisma/enums.js';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeUser } from '../serializers.js';
import { sendPushToUsers } from '../services/push.js';
import { log, safeErrorFields } from '../lib/logger.js';
import { createRateLimit } from '../middleware/rate-limit.js';

export const linksRouter = Router();
linksRouter.use(requireAuth);

const generateCodeRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  prefix: 'link-code-generate',
  key: (req) => req.auth?.userId ?? req.ip ?? req.socket.remoteAddress ?? 'unknown',
});
const redeemCodeRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 10, prefix: 'link-code-redeem' });

linksRouter.get('/', async (req, res) => {
  if (req.auth!.type === UserType.ELDER) {
    const links = await prisma.caregiverElderLink.findMany({
      where: { elderId: req.auth!.userId, status: LinkStatus.ACTIVE },
      include: { caregiver: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      vinculos: links.map((link) => ({
        id: link.id,
        usuario: serializeUser(link.caregiver),
        vinculadoEm: link.createdAt,
      })),
    });
    return;
  }

  const links = await prisma.caregiverElderLink.findMany({
    where: { caregiverId: req.auth!.userId, status: LinkStatus.ACTIVE },
    include: { elder: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({
    vinculos: links.map((link) => ({
      id: link.id,
      usuario: serializeUser(link.elder),
      vinculadoEm: link.createdAt,
    })),
  });
});

linksRouter.post('/codigo', generateCodeRateLimit, async (req, res) => {
  if (req.auth!.type !== UserType.ELDER) {
    throw new HttpError(403, 'Somente o paciente pode gerar um código de vínculo.', 'ELDER_ONLY');
  }

  await prisma.elderLinkCode.deleteMany({
    where: { elderId: req.auth!.userId, usedAt: null },
  });

  let created: { code: string; expiresAt: Date } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    try {
      created = await prisma.elderLinkCode.create({
        data: {
          elderId: req.auth!.userId,
          code,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
        select: { code: true, expiresAt: true },
      });
    } catch {
      // Uma colisão é rara; o laço tenta outro código.
    }
  }

  if (!created) throw new HttpError(503, 'Não foi possível gerar o código agora.', 'CODE_GENERATION_FAILED');
  res.status(201).json({ codigo: created.code, expiraEm: created.expiresAt });
});

linksRouter.post('/', redeemCodeRateLimit, async (req, res) => {
  if (req.auth!.type !== UserType.CAREGIVER) {
    throw new HttpError(403, 'Somente cuidadores podem usar um código de vínculo.', 'CAREGIVER_ONLY');
  }
  const { codigo } = z.object({ codigo: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const link = await prisma.$transaction(async (tx) => {
    const code = await tx.elderLinkCode.findUnique({ where: { code: codigo } });
    if (!code || code.usedAt || code.expiresAt <= new Date()) {
      throw new HttpError(400, 'Código inválido ou expirado.', 'INVALID_LINK_CODE');
    }
    if (code.elderId === req.auth!.userId) {
      throw new HttpError(400, 'Não é possível vincular a própria conta.', 'SELF_LINK');
    }

    // Claim atomically: two requests must never redeem the same code.
    const claimed = await tx.elderLinkCode.updateMany({
      where: { id: code.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new HttpError(400, 'Código inválido ou expirado.', 'INVALID_LINK_CODE');

    const saved = await tx.caregiverElderLink.upsert({
      where: {
        caregiverId_elderId: { caregiverId: req.auth!.userId, elderId: code.elderId },
      },
      create: { caregiverId: req.auth!.userId, elderId: code.elderId, status: LinkStatus.ACTIVE },
      update: { status: LinkStatus.ACTIVE },
      include: { elder: true },
    });
    return saved;
  });

  res.status(201).json({
    vinculo: { id: link.id, usuario: serializeUser(link.elder), vinculadoEm: link.createdAt },
  });
  void sendPushToUsers([link.elderId], {
    title: 'Novo cuidador vinculado',
    body: 'Um cuidador usou seu código e agora faz parte da sua rede de cuidado.',
    data: { tipo: 'novo_vinculo' },
  }, undefined, 'link_update').catch((error) => log('error', 'link_notification_failed', safeErrorFields(error)));
});

linksRouter.delete('/:vinculoId', async (req, res) => {
  const linkId = z.uuid().parse(req.params.vinculoId);
  const link = await prisma.caregiverElderLink.findUnique({ where: { id: linkId } });
  if (!link) throw new HttpError(404, 'Vínculo não encontrado.', 'LINK_NOT_FOUND');
  if (link.elderId !== req.auth!.userId && link.caregiverId !== req.auth!.userId) {
    throw new HttpError(403, 'Você não pode remover este vínculo.', 'LINK_ACCESS_DENIED');
  }

  await prisma.caregiverElderLink.update({
    where: { id: linkId },
    data: { status: LinkStatus.REVOKED },
  });
  res.status(204).send();
});
