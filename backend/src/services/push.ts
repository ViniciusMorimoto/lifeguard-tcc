import { prisma } from '../lib/prisma.js';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type NotificationCategory = 'health_alert' | 'link_update' | 'system';

type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

export function acceptsNotificationCategory(
  preferences: { notifyHealthAlerts: boolean; notifyLinkUpdates: boolean },
  category: NotificationCategory,
) {
  if (category === 'health_alert') return preferences.notifyHealthAlerts;
  if (category === 'link_update') return preferences.notifyLinkUpdates;
  return true;
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  alertId?: string,
  category: NotificationCategory = 'system',
) {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return 0;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: uniqueUserIds }, active: true },
    select: {
      id: true,
      userId: true,
      token: true,
      user: { select: { notifyHealthAlerts: true, notifyLinkUpdates: true } },
    },
  });
  const eligibleTokens = tokens.filter(({ user }) => acceptsNotificationCategory(user, category));
  if (eligibleTokens.length === 0) return 0;

  let sent = 0;
  for (let offset = 0; offset < eligibleTokens.length; offset += 100) {
    const chunk = eligibleTokens.slice(offset, offset + 100);
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      signal: AbortSignal.timeout(15_000),
      method: 'POST',
      headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.map(({ token }) => ({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
        channelId: 'alertas',
        priority: 'high',
      }))),
    });
    if (!response.ok) throw new Error(`Expo Push respondeu com status ${response.status}.`);

    const result = await response.json() as { data?: ExpoTicket[] };
    const tickets = result.data ?? [];
    for (let index = 0; index < chunk.length; index += 1) {
      const token = chunk[index];
      const ticket = tickets[index];
      if (!token) continue;
      await prisma.pushDelivery.create({ data: {
        userId: token.userId, pushTokenId: token.id,
        providerId: ticket?.status === 'ok' ? ticket.id : null,
        status: ticket?.status === 'ok' ? 'pending' : 'failed',
        errorCode: ticket?.status === 'error' ? (ticket.details?.error ?? 'ProviderError') : ticket ? null : 'MissingTicket',
        nextCheckAt: new Date(Date.now() + 15 * 60_000),
      } });
      if (!ticket) continue;
      if (ticket.status === 'ok') {
        sent += 1;
        if (alertId) {
          await prisma.notificationSent.create({
            data: { alertId, recipientId: token.userId, providerId: ticket.id },
          });
        }
      } else if (ticket.details?.error === 'DeviceNotRegistered') {
        await prisma.pushToken.update({ where: { id: token.id }, data: { active: false } });
      }
    }
  }
  return sent;
}
