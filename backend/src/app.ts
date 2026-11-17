import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { linksRouter } from './routes/links.js';
import { monitoringRouter } from './routes/monitoring.js';
import { notificationsRouter } from './routes/notifications.js';
import { devicesRouter } from './routes/devices.js';
import { prisma } from './lib/prisma.js';
import { requestLogging } from './middleware/request-logging.js';
import { createRateLimit } from './middleware/rate-limit.js';

export const app = express();

const allowedBrowserOrigins = env.APP_ORIGIN
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const apiRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 180,
  prefix: 'api',
});

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Aplicativos nativos não enviam Origin. O curinga fica restrito ao
    // desenvolvimento para não liberar sites arbitrários em produção.
    const allowed = !origin
      || allowedBrowserOrigins.includes(origin)
      || (env.NODE_ENV !== 'production' && allowedBrowserOrigins.includes('*'));
    callback(null, allowed);
  },
}));
app.use(requestLogging);
app.use('/api', apiRateLimit);
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', servico: 'lifeguard-api', banco: 'ok', horario: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'indisponivel', servico: 'lifeguard-api', banco: 'indisponivel', horario: new Date().toISOString() });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/vinculos', linksRouter);
app.use('/api/notificacoes', notificationsRouter);
app.use('/api/dispositivos', devicesRouter);
app.use('/api', monitoringRouter);
app.use(notFoundHandler);
app.use(errorHandler);
