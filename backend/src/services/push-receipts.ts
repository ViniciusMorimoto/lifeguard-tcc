import { prisma } from '../lib/prisma.js';
import { log } from '../lib/logger.js';

export type PushReceipt = { status: 'ok' | 'error'; details?: { error?: string } };
const MINUTE = 60_000;
let running = false;

export function receiptOutcome(receipt: PushReceipt | undefined, createdAt: Date, now: Date) {
  if (receipt?.status === 'ok') return { status: 'accepted', errorCode: null };
  if (receipt?.status === 'error') return { status: 'failed', errorCode: receipt.details?.error ?? 'ProviderError' };
  if (now.getTime() - createdAt.getTime() >= 24 * 60 * MINUTE) return { status: 'unknown', errorCode: 'ReceiptExpired' };
  return null;
}

export async function checkPushReceipts() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const pending = await prisma.pushDelivery.findMany({
      where: { status: 'pending', nextCheckAt: { lte: now }, providerId: { not: null } },
      orderBy: { nextCheckAt: 'asc' }, take: 300,
    });
    if (!pending.length) return;
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pending.map((delivery) => delivery.providerId) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Push receipts HTTP ${response.status}`);
    const result = await response.json() as { data?: Record<string, PushReceipt>; errors?: unknown[] };
    if (!result.data || result.errors?.length) throw new Error('Invalid push receipts response');
    for (const delivery of pending) {
      const outcome = receiptOutcome(result.data[delivery.providerId!], delivery.createdAt, now);
      await prisma.$transaction(async (tx) => {
        await tx.pushDelivery.update({ where: { id: delivery.id }, data: {
          ...(outcome ?? {}), checkedAt: now, nextCheckAt: new Date(now.getTime() + 15 * MINUTE),
        } });
        if (outcome?.errorCode === 'DeviceNotRegistered' && delivery.pushTokenId) {
          // A later registration must not be invalidated by an older receipt.
          await tx.pushToken.updateMany({
            where: { id: delivery.pushTokenId, userId: delivery.userId, updatedAt: { lte: delivery.createdAt } },
            data: { active: false },
          });
        }
      });
    }
    log('info', 'push_receipts_checked', { count: pending.length });
  } finally { running = false; }
}

export function startPushReceiptWorker() {
  const tick = () => void checkPushReceipts().catch(() => log('warn', 'push_receipts_unavailable'));
  const timer = setInterval(tick, MINUTE);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
