import { prisma } from '../lib/prisma.js';
import { log, safeErrorFields } from '../lib/logger.js';
import { sendPushToUsers } from './push.js';

// Persistent queue: ingestion commits quickly even when the push provider is down.
export async function dispatchDeviceAlerts(send = sendPushToUsers) {
  const now = new Date();
  const pending = await prisma.deviceAlertDispatch.findMany({
    where: { sentAt: null, nextAt: { lte: now }, attempts: { lt: 5 } },
    orderBy: { nextAt: 'asc' }, take: 10, include: { alert: true },
  });
  for (const item of pending) {
    const claimed = await prisma.deviceAlertDispatch.updateMany({
      where: { id: item.id, sentAt: null, nextAt: { lte: now }, attempts: item.attempts },
      data: { attempts: { increment: 1 }, nextAt: new Date(Date.now() + 120_000) },
    });
    if (!claimed.count) continue;
    try {
      // Only currently linked caregivers; never the patient's own phone.
      const links = await prisma.caregiverElderLink.findMany({
        where: { elderId: item.alert.elderId, status: 'ACTIVE' }, select: { caregiverId: true },
      });
      await send(links.map((link) => link.caregiverId), {
        title: item.alert.message.startsWith('[SIMULAÇÃO]') ? 'Demonstração LifeGuard' : 'Alerta de saúde', body: item.alert.message,
        data: { tipo: 'alerta', alertaId: item.alertId, pacienteId: item.alert.elderId },
      }, item.alertId, 'health_alert');
      await prisma.deviceAlertDispatch.update({ where: { id: item.id }, data: { sentAt: new Date() } });
    } catch (error) {
      log('error', 'device_alert_dispatch_failed', { attempts: item.attempts + 1, ...safeErrorFields(error) });
    }
  }
}

export function startDeviceAlertWorker() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await dispatchDeviceAlerts(); }
    catch (error) { log('error', 'device_alert_worker_failed', safeErrorFields(error)); }
    finally { running = false; }
  };
  const timer = setInterval(() => void run(), 15_000);
  timer.unref();
  void run();
  return () => clearInterval(timer);
}
