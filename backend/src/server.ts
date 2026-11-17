import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { log } from './lib/logger.js';
import { startPushReceiptWorker } from './services/push-receipts.js';
import { startDeviceAlertWorker } from './services/device-alerts.js';

const stopPushReceiptWorker = startPushReceiptWorker();
const stopDeviceAlertWorker = startDeviceAlertWorker();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  log('info', 'server_started', { port: env.PORT, environment: env.NODE_ENV });
});

async function shutdown(signal: string) {
  stopPushReceiptWorker();
  stopDeviceAlertWorker();
  log('info', 'server_shutdown', { signal });
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
