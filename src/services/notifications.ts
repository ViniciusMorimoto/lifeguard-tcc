import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from './api';

const PUSH_TOKEN_KEY = 'lifeguard.push-token.v1';
const ALERT_CHANNEL = 'alertas';

export type NotificationPreferences = {
  alertasSaude: boolean;
  atualizacoesVinculo: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
    name: 'Alertas de cuidado',
    description: 'Avisos importantes sobre pacientes e vínculos de cuidado.',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: '#35B8C8',
    sound: 'default',
  });
}

export async function getNotificationPermission() {
  await configureAndroidChannel();
  return Notifications.getPermissionsAsync();
}

export async function registerForPushNotifications(requestPermission = true) {
  if (!Device.isDevice) throw new Error('As notificações push precisam ser testadas em um celular físico.');
  await configureAndroidChannel();

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && requestPermission) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') {
    throw new Error('Permissão de notificações não concedida.');
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('O projeto de notificações não foi configurado.');

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await apiRequest('/notificacoes/token', {
    method: 'POST',
    body: JSON.stringify({ token, plataforma: Platform.OS }),
  });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  return token;
}

export async function unregisterPushNotifications() {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await apiRequest('/notificacoes/token', { method: 'DELETE', body: JSON.stringify({ token }) });
  } finally {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
}

export function getStoredPushToken() {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

export async function sendTestNotification() {
  return apiRequest<{ enviadas: number; destino: 'cuidadores' | 'este_aparelho' }>('/notificacoes/teste', { method: 'POST' });
}

export async function getNotificationPreferences() {
  return apiRequest<{ preferencias: NotificationPreferences }>('/notificacoes/preferencias');
}

export async function updateNotificationPreferences(preferences: Partial<NotificationPreferences>) {
  return apiRequest<{ preferencias: NotificationPreferences }>('/notificacoes/preferencias', {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  });
}
