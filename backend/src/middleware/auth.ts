import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/token.js';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Autenticação necessária.', 'AUTH_REQUIRED'));
    return;
  }

  try {
    const token = await verifyAccessToken(authorization.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      select: { type: true, sessionVersion: true },
    });
    if (!user || user.type !== token.type || user.sessionVersion !== token.sessionVersion) {
      throw new Error('Sessão revogada');
    }
    if (token.sessionId) {
      const session = await prisma.authSession.findFirst({
        where: {
          id: token.sessionId,
          userId: token.userId,
          sessionVersion: token.sessionVersion,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { lastSeenAt: true },
      });
      if (!session) throw new Error('Sessão revogada ou expirada');

      if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
        void prisma.authSession.update({
          where: { id: token.sessionId },
          data: { lastSeenAt: new Date() },
        }).catch(() => undefined);
      }
    }
    req.auth = token;
    next();
  } catch {
    next(new HttpError(401, 'Token inválido ou expirado.', 'INVALID_TOKEN'));
  }
}
