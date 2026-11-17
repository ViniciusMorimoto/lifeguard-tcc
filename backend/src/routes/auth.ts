import { compare, hash } from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { createAccessToken } from '../auth/token.js';
import { AccountCodeType, Gender, UserType } from '../generated/prisma/enums.js';
import { ACCOUNT_CODE_DURATION_MS, ACCOUNT_CODE_MAX_ATTEMPTS, ACCOUNT_CODE_RESEND_MS, accountCodeMatches, createAccountCode, hashAccountCode } from '../domain/account-codes.js';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { assertLoginAllowed, clearLoginFailures, registerLoginFailure } from '../middleware/login-rate-limit.js';
import { createRateLimit } from '../middleware/rate-limit.js';
import { serializeElderProfile, serializeGender, serializeUser } from '../serializers.js';
import { assertEmailConfigured, sendEmailVerificationCode, sendPasswordResetCode } from '../services/email.js';
import { env } from '../config/env.js';

const strongPasswordSchema = z.string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.')
  .regex(/[a-zà-öø-ÿ]/, 'A senha deve ter uma letra minúscula.')
  .regex(/[A-ZÀ-ÖØ-Þ]/, 'A senha deve ter uma letra maiúscula.')
  .regex(/\d/, 'A senha deve ter um número.')
  .regex(/[^\p{L}\p{N}\s]/u, 'A senha deve ter um caractere especial.');

const registerSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.email().transform((email) => email.toLowerCase()),
  telefone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Telefone internacional inválido.'),
  genero: z.enum(['feminino', 'masculino', 'nao_binario', 'outro', 'prefiro_nao_informar']),
  senha: strongPasswordSchema,
  tipo: z.enum(['idoso', 'cuidador']),
  aceitouTermos: z.literal(true, { error: 'É necessário aceitar os Termos de Uso.' }),
  aceitouPrivacidade: z.literal(true, { error: 'É necessário aceitar a Política de Privacidade.' }),
});

const loginSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  senha: z.string().min(1),
});

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const registerRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, prefix: 'register' });
const recoveryRequestRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 5, prefix: 'recovery-request' });
const recoveryConfirmRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 10, prefix: 'recovery-confirm' });
const sensitiveAccountRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  prefix: 'sensitive-account-action',
  key: (req) => req.auth?.userId ?? req.ip ?? req.socket.remoteAddress ?? 'unknown',
});
const verificationRequestRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  prefix: 'verification-request',
  key: (req) => req.auth?.userId ?? req.ip ?? req.socket.remoteAddress ?? 'unknown',
});

async function createTrackedSession(user: { id: string; type: UserType; sessionVersion: number }) {
  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      sessionVersion: user.sessionVersion,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return createAccessToken(user.id, user.type, user.sessionVersion, session.id);
}

async function issueAccountCode(user: { id: string; email: string }, type: AccountCodeType) {
  const now = new Date();
  const recent = await prisma.accountCode.findFirst({
    where: {
      userId: user.id,
      type,
      usedAt: null,
      createdAt: { gt: new Date(now.getTime() - ACCOUNT_CODE_RESEND_MS) },
    },
  });
  if (recent) return;

  const code = createAccountCode();
  const record = await prisma.$transaction(async (tx) => {
    await tx.accountCode.updateMany({
      where: { userId: user.id, type, usedAt: null },
      data: { usedAt: now },
    });
    return tx.accountCode.create({
      data: {
        userId: user.id,
        type,
        codeHash: hashAccountCode(code, env.JWT_SECRET),
        expiresAt: new Date(now.getTime() + ACCOUNT_CODE_DURATION_MS),
      },
    });
  });

  try {
    if (type === AccountCodeType.EMAIL_VERIFICATION) await sendEmailVerificationCode(user.email, code);
    else await sendPasswordResetCode(user.email, code);
  } catch (error) {
    await prisma.accountCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}

async function findValidAccountCode(userId: string, type: AccountCodeType, code: string) {
  const record = await prisma.accountCode.findFirst({
    where: { userId, type, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.attempts >= ACCOUNT_CODE_MAX_ATTEMPTS || !accountCodeMatches(code, record.codeHash, env.JWT_SECRET)) {
    if (record) {
      const attempts = record.attempts + 1;
      await prisma.accountCode.update({
        where: { id: record.id },
        data: { attempts, ...(attempts >= ACCOUNT_CODE_MAX_ATTEMPTS ? { usedAt: new Date() } : {}) },
      });
    }
    throw new HttpError(400, 'Código inválido ou expirado. Solicite um novo código.', 'INVALID_OR_EXPIRED_CODE');
  }
  return record;
}

const updateProfileSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.email().transform((email) => email.toLowerCase()),
  senhaAtual: z.string().max(72).optional(),
  telefone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Telefone internacional inválido.').nullable().optional(),
  foto: z.string().max(750_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/).nullable().optional(),
  genero: z.enum(['feminino', 'masculino', 'nao_binario', 'outro', 'prefiro_nao_informar']).nullable().optional(),
  perfilIdoso: z.object({
    dataNascimento: z.iso.date().nullable().optional(),
    tipoSanguineo: z.string().trim().max(5).nullable().optional(),
    alergias: z.string().trim().max(1000).nullable().optional(),
    medicamentos: z.string().trim().max(1000).nullable().optional(),
    condicoesMedicas: z.string().trim().max(1000).nullable().optional(),
    observacoesImportantes: z.string().trim().max(1000).nullable().optional(),
    contatoEmergenciaNome: z.string().trim().max(100).nullable().optional(),
    contatoEmergenciaTelefone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Telefone de emergência inválido.').nullable().optional(),
  }).refine(
    (profile) => Boolean(profile.contatoEmergenciaNome) === Boolean(profile.contatoEmergenciaTelefone),
    { message: 'Informe o nome e o telefone do contato de emergência.', path: ['contatoEmergenciaTelefone'] },
  ).optional(),
});

export const authRouter = Router();

const genderMap = {
  feminino: Gender.FEMALE,
  masculino: Gender.MALE,
  nao_binario: Gender.NON_BINARY,
  outro: Gender.OTHER,
  prefiro_nao_informar: Gender.PREFER_NOT_TO_SAY,
} as const;

authRouter.post('/cadastro', registerRateLimit, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing) throw new HttpError(409, 'Este e-mail já está cadastrado.', 'EMAIL_IN_USE');

  const type = input.tipo === 'idoso' ? UserType.ELDER : UserType.CAREGIVER;
  const acceptedAt = new Date();
  const user = await prisma.user.create({
    data: {
      name: input.nome,
      email: input.email,
      phone: input.telefone,
      gender: genderMap[input.genero],
      passwordHash: await hash(input.senha, 12),
      type,
      termsAcceptedAt: acceptedAt,
      privacyAcceptedAt: acceptedAt,
      legalDocumentVersion: '2026-09-01',
      ...(type === UserType.ELDER
        ? {
            elderProfile: { create: {} },
            alertLimits: { create: {} },
          }
        : {}),
    },
    include: { elderProfile: true },
  });

  const emailConfirmacaoEnviado = await issueAccountCode(user, AccountCodeType.EMAIL_VERIFICATION)
    .then(() => true)
    .catch(() => false);

  res.status(201).json({
    token: await createTrackedSession(user),
    usuario: serializeUser(user, user.elderProfile),
    emailConfirmacaoEnviado,
  });
});

authRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  assertLoginAllowed(req, input.email);
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: { elderProfile: true } });

  if (!user || !(await compare(input.senha, user.passwordHash))) {
    registerLoginFailure(req, input.email);
    throw new HttpError(401, 'E-mail ou senha incorretos.', 'INVALID_CREDENTIALS');
  }
  clearLoginFailures(req, input.email);

  res.json({
    token: await createTrackedSession(user),
    usuario: serializeUser(user, user.elderProfile),
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, include: { elderProfile: true } });
  if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  res.json({ usuario: serializeUser(user, user.elderProfile) });
});

authRouter.get('/me/exportacao', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      type: true,
      profilePhoto: true,
      gender: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
      legalDocumentVersion: true,
      emailVerifiedAt: true,
      notifyHealthAlerts: true,
      notifyLinkUpdates: true,
      createdAt: true,
      updatedAt: true,
      elderProfile: true,
      alertLimits: {
        select: {
          heartRateMinimum: true,
          heartRateMaximum: true,
          temperatureMinimum: true,
          temperatureMaximum: true,
          updatedAt: true,
        },
      },
      caregiverLinks: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          elder: { select: { id: true, name: true } },
        },
      },
      elderLinks: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          caregiver: { select: { id: true, name: true } },
        },
      },
      devices: {
        select: {
          id: true,
          hardwareCode: true,
          nickname: true,
          active: true,
          pairedAt: true,
          lastSeenAt: true,
          readings: {
            orderBy: { timestamp: 'asc' },
            select: {
              id: true,
              heartRate: true,
              temperature: true,
              timestamp: true,
              source: true,
              signalQuality: true,
              contactDetected: true,
              valid: true,
              invalidReason: true,
            },
          },
          aggregates: {
            orderBy: { periodStart: 'asc' },
            select: {
              id: true,
              period: true,
              periodStart: true,
              sampleCount: true,
              heartRateAverage: true,
              heartRateMinimum: true,
              heartRateMaximum: true,
              temperatureAverage: true,
              temperatureMinimum: true,
              temperatureMaximum: true,
            },
          },
        },
      },
      alerts: {
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          type: true,
          measuredValue: true,
          message: true,
          timestamp: true,
          status: true,
          resolvedAt: true,
        },
      },
      notificationRecipients: {
        orderBy: { sentAt: 'asc' },
        select: {
          id: true,
          sentAt: true,
          readAt: true,
          alert: {
            select: {
              id: true,
              type: true,
              message: true,
              timestamp: true,
              status: true,
            },
          },
        },
      },
      sessions: {
        orderBy: { createdAt: 'asc' },
        select: {
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      },
      patientChanges: {
        orderBy: { createdAt: 'asc' },
        select: {
          category: true,
          changedFields: true,
          createdAt: true,
          changedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');

  res.json({
    formato: 'lifeguard-exportacao-v1',
    geradoEm: new Date().toISOString(),
    observacao: 'Senhas, códigos temporários, tokens de acesso e tokens de notificação não fazem parte desta exportação por segurança.',
    conta: {
      id: user.id,
      nome: user.name,
      email: user.email,
      emailConfirmadoEm: user.emailVerifiedAt?.toISOString() ?? null,
      telefone: user.phone,
      genero: serializeGender(user.gender),
      tipo: user.type === UserType.ELDER ? 'paciente' : 'cuidador',
      fotoPerfilArmazenada: Boolean(user.profilePhoto),
      criadaEm: user.createdAt.toISOString(),
      atualizadaEm: user.updatedAt.toISOString(),
    },
    consentimentos: {
      termosDeUsoAceitosEm: user.termsAcceptedAt?.toISOString() ?? null,
      politicaDePrivacidadeAceitaEm: user.privacyAcceptedAt?.toISOString() ?? null,
      versaoDosDocumentos: user.legalDocumentVersion,
    },
    preferencias: {
      alertasDeSaude: user.notifyHealthAlerts,
      atualizacoesDeVinculo: user.notifyLinkUpdates,
    },
    perfilPaciente: serializeElderProfile(user.elderProfile),
    limitesDeAlerta: user.alertLimits,
    vinculosComoCuidador: user.caregiverLinks.map((link) => ({
      id: link.id,
      status: link.status,
      paciente: link.elder,
      criadoEm: link.createdAt.toISOString(),
      atualizadoEm: link.updatedAt.toISOString(),
    })),
    vinculosComoPaciente: user.elderLinks.map((link) => ({
      id: link.id,
      status: link.status,
      cuidador: link.caregiver,
      criadoEm: link.createdAt.toISOString(),
      atualizadoEm: link.updatedAt.toISOString(),
    })),
    dispositivos: user.devices.map((device) => ({
      ...device,
      pairedAt: device.pairedAt.toISOString(),
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      readings: device.readings.map((reading) => ({
        ...reading,
        id: reading.id.toString(),
        timestamp: reading.timestamp.toISOString(),
      })),
      aggregates: device.aggregates.map((aggregate) => ({
        ...aggregate,
        id: aggregate.id.toString(),
        periodStart: aggregate.periodStart.toISOString(),
      })),
    })),
    alertas: user.alerts,
    notificacoesRecebidas: user.notificationRecipients,
    sessoes: user.sessions,
    historicoDeAlteracoes: user.patientChanges.map((change) => ({
      categoria: change.category === 'ALERT_LIMITS' ? 'limites_de_alerta' : 'perfil',
      camposAlterados: change.changedFields,
      alteradoEm: change.createdAt.toISOString(),
      alteradoPor: change.changedBy,
    })),
  });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  const emailOwner = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== req.auth!.userId) {
    throw new HttpError(409, 'Este e-mail já está cadastrado.', 'EMAIL_IN_USE');
  }
  const currentUser = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { elderProfile: true },
  });
  if (!currentUser) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (input.perfilIdoso && currentUser.type !== UserType.ELDER) {
    throw new HttpError(403, 'Somente o paciente pode preencher suas informações de saúde.', 'ELDER_ONLY');
  }

  const profile = input.perfilIdoso;
  const emailChanged = currentUser.email !== input.email;
  if (emailChanged) {
    assertLoginAllowed(req, currentUser.email);
    if (!input.senhaAtual || !(await compare(input.senhaAtual, currentUser.passwordHash))) {
      registerLoginFailure(req, currentUser.email);
      throw new HttpError(401, 'Confirme sua senha atual para alterar o e-mail.', 'CURRENT_PASSWORD_INCORRECT');
    }
    clearLoginFailures(req, currentUser.email);
    await prisma.accountCode.updateMany({
      where: { userId: req.auth!.userId, type: AccountCodeType.EMAIL_VERIFICATION, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
  const profileData = profile ? {
    birthDate: profile.dataNascimento ? new Date(`${profile.dataNascimento}T12:00:00.000Z`) : null,
    bloodType: profile.tipoSanguineo || null,
    allergies: profile.alergias || null,
    medications: profile.medicamentos || null,
    medicalConditions: profile.condicoesMedicas || null,
    importantNotes: profile.observacoesImportantes || null,
    emergencyContactName: profile.contatoEmergenciaNome || null,
    emergencyContactPhone: profile.contatoEmergenciaTelefone || null,
  } : undefined;

  const changedFields: string[] = [];
  if (currentUser.name !== input.nome) changedFields.push('nome');
  if (currentUser.email !== input.email) changedFields.push('email');
  if (currentUser.phone !== (input.telefone || null)) changedFields.push('telefone');
  if (input.genero !== undefined && currentUser.gender !== (input.genero ? genderMap[input.genero] : null)) changedFields.push('genero');
  if (input.foto !== undefined && currentUser.profilePhoto !== input.foto) changedFields.push('foto');

  if (profileData) {
    const currentProfile = currentUser.elderProfile;
    const birthDateChanged = currentProfile?.birthDate?.toISOString().slice(0, 10) !== profileData.birthDate?.toISOString().slice(0, 10);
    if (birthDateChanged) changedFields.push('data_nascimento');
    if ((currentProfile?.bloodType ?? null) !== profileData.bloodType) changedFields.push('tipo_sanguineo');
    if ((currentProfile?.allergies ?? null) !== profileData.allergies) changedFields.push('alergias');
    if ((currentProfile?.medications ?? null) !== profileData.medications) changedFields.push('medicamentos');
    if ((currentProfile?.medicalConditions ?? null) !== profileData.medicalConditions) changedFields.push('condicoes_medicas');
    if ((currentProfile?.importantNotes ?? null) !== profileData.importantNotes) changedFields.push('observacoes_importantes');
    if ((currentProfile?.emergencyContactName ?? null) !== profileData.emergencyContactName) changedFields.push('contato_emergencia_nome');
    if ((currentProfile?.emergencyContactPhone ?? null) !== profileData.emergencyContactPhone) changedFields.push('contato_emergencia_telefone');
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: req.auth!.userId },
      data: {
        name: input.nome,
        email: input.email,
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
        phone: input.telefone || null,
        ...(input.genero !== undefined ? { gender: input.genero ? genderMap[input.genero] : null } : {}),
        ...(input.foto !== undefined ? { profilePhoto: input.foto } : {}),
        ...(profileData ? { elderProfile: { upsert: { create: profileData, update: profileData } } } : {}),
      },
      include: { elderProfile: true },
    });
    if (currentUser.type === UserType.ELDER && changedFields.length > 0) {
      await tx.patientChangeLog.create({
        data: {
          patientId: currentUser.id,
          changedById: currentUser.id,
          category: 'PROFILE',
          changedFields,
        },
      });
    }
    return updated;
  });
  res.json({ usuario: serializeUser(user, user.elderProfile) });
});

authRouter.post('/email/confirmacao/solicitar', requireAuth, verificationRequestRateLimit, async (req, res) => {
  assertEmailConfigured();
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (!user.emailVerifiedAt) await issueAccountCode(user, AccountCodeType.EMAIL_VERIFICATION);
  res.json({
    emailVerificado: Boolean(user.emailVerifiedAt),
    mensagem: user.emailVerifiedAt ? 'Seu e-mail já está confirmado.' : 'Enviamos um código para o seu e-mail.',
  });
});

authRouter.get('/email/status', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { emailVerifiedAt: true },
  });
  if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  res.json({ emailVerificado: Boolean(user.emailVerifiedAt) });
});

authRouter.post('/email/confirmacao/confirmar', requireAuth, async (req, res) => {
  const input = z.object({ codigo: z.string().trim().regex(/^\d{6}$/, 'Informe o código de 6 dígitos.') }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { emailVerifiedAt: true } });
  if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (user.emailVerifiedAt) {
    res.json({ emailVerificado: true, mensagem: 'Seu e-mail já está confirmado.' });
    return;
  }
  const record = await findValidAccountCode(req.auth!.userId, AccountCodeType.EMAIL_VERIFICATION, input.codigo);
  await prisma.$transaction([
    prisma.accountCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: req.auth!.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  res.json({ emailVerificado: true, mensagem: 'E-mail confirmado com sucesso.' });
});

authRouter.post('/senha/recuperacao/solicitar', recoveryRequestRateLimit, async (req, res) => {
  const input = z.object({ email: z.email().transform((email) => email.toLowerCase()) }).parse(req.body);
  assertEmailConfigured();
  const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, email: true } });
  if (user) await issueAccountCode(user, AccountCodeType.PASSWORD_RESET);
  res.json({ mensagem: 'Se o e-mail estiver cadastrado, enviaremos um código de recuperação.' });
});

authRouter.post('/senha/recuperacao/confirmar', recoveryConfirmRateLimit, async (req, res) => {
  const input = z.object({
    email: z.email().transform((email) => email.toLowerCase()),
    codigo: z.string().trim().regex(/^\d{6}$/, 'Informe o código de 6 dígitos.'),
    novaSenha: strongPasswordSchema,
  }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, passwordHash: true } });
  if (!user) throw new HttpError(400, 'Código inválido ou expirado. Solicite um novo código.', 'INVALID_OR_EXPIRED_CODE');
  const record = await findValidAccountCode(user.id, AccountCodeType.PASSWORD_RESET, input.codigo);
  if (await compare(input.novaSenha, user.passwordHash)) {
    throw new HttpError(400, 'A nova senha deve ser diferente da senha atual.', 'PASSWORD_UNCHANGED');
  }
  const now = new Date();
  const newPasswordHash = await hash(input.novaSenha, 12);
  await prisma.$transaction([
    prisma.accountCode.update({ where: { id: record.id }, data: { usedAt: now } }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash, sessionVersion: { increment: 1 } },
    }),
    prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
    prisma.pushToken.updateMany({ where: { userId: user.id, active: true }, data: { active: false } }),
  ]);
  res.json({ mensagem: 'Senha alterada com sucesso. Entre novamente com a nova senha.' });
});

authRouter.patch('/senha', requireAuth, sensitiveAccountRateLimit, async (req, res) => {
  const input = z.object({
    senhaAtual: z.string().min(1, 'Informe sua senha atual.'),
    novaSenha: strongPasswordSchema,
  }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (!(await compare(input.senhaAtual, user.passwordHash))) {
    throw new HttpError(401, 'A senha atual está incorreta.', 'CURRENT_PASSWORD_INCORRECT');
  }
  if (await compare(input.novaSenha, user.passwordHash)) {
    throw new HttpError(400, 'A nova senha deve ser diferente da senha atual.', 'PASSWORD_UNCHANGED');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(input.novaSenha, 12) },
  });
  res.status(204).send();
});

authRouter.post('/sessoes/revogar-outras', requireAuth, async (req, res) => {
  const input = z.object({
    tokenPushAtual: z.string().trim().max(300).regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/).nullable().optional(),
  }).parse(req.body ?? {});

  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const updated = await tx.user.update({
      where: { id: req.auth!.userId },
      data: { sessionVersion: { increment: 1 } },
      select: { id: true, type: true, sessionVersion: true },
    });
    await tx.authSession.updateMany({
      where: {
        userId: updated.id,
        revokedAt: null,
        ...(req.auth!.sessionId ? { id: { not: req.auth!.sessionId } } : {}),
      },
      data: { revokedAt: now },
    });
    const session = req.auth!.sessionId
      ? await tx.authSession.update({
          where: { id: req.auth!.sessionId },
          data: {
            sessionVersion: updated.sessionVersion,
            lastSeenAt: now,
            expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
          },
        })
      : await tx.authSession.create({
          data: {
            userId: updated.id,
            sessionVersion: updated.sessionVersion,
            expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
          },
        });
    await tx.pushToken.updateMany({
      where: {
        userId: updated.id,
        active: true,
        ...(input.tokenPushAtual ? { token: { not: input.tokenPushAtual } } : {}),
      },
      data: { active: false },
    });
    return { user: updated, session };
  });

  res.json({
    token: await createAccessToken(result.user.id, result.user.type, result.user.sessionVersion, result.session.id),
    quantidade: 1,
    mensagem: 'Os outros dispositivos foram desconectados.',
  });
});

authRouter.get('/sessoes/resumo', requireAuth, async (req, res) => {
  const now = new Date();
  let sessionId = req.auth!.sessionId;
  let replacementToken: string | undefined;

  if (!sessionId) {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { id: true, type: true, sessionVersion: true },
    });
    if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        sessionVersion: user.sessionVersion,
        expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
      },
    });
    sessionId = session.id;
    replacementToken = await createAccessToken(user.id, user.type, user.sessionVersion, session.id);
  }

  await prisma.authSession.updateMany({
    where: { userId: req.auth!.userId, revokedAt: null, expiresAt: { lte: now } },
    data: { revokedAt: now },
  });
  const quantidade = await prisma.authSession.count({
    where: {
      userId: req.auth!.userId,
      sessionVersion: req.auth!.sessionVersion,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });

  res.json({ quantidade, ...(replacementToken ? { token: replacementToken } : {}) });
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  if (req.auth!.sessionId) {
    await prisma.authSession.updateMany({
      where: { id: req.auth!.sessionId, userId: req.auth!.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.status(204).send();
});

authRouter.delete('/me', requireAuth, sensitiveAccountRateLimit, async (req, res) => {
  const input = z.object({ senha: z.string().min(1, 'Informe sua senha para excluir a conta.') }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'USER_NOT_FOUND');
  if (!(await compare(input.senha, user.passwordHash))) {
    throw new HttpError(401, 'A senha informada está incorreta.', 'CURRENT_PASSWORD_INCORRECT');
  }
  await prisma.user.delete({ where: { id: user.id } });
  res.status(204).send();
});
