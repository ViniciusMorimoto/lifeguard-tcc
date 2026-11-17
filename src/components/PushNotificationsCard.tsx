import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { PermissionStatus } from 'expo-notifications';
import Card from './Card';
import AppButton from './AppButton';
import { colors, fonts } from '../theme/theme';
import {
  getNotificationPermission,
  getNotificationPreferences,
  registerForPushNotifications,
  sendTestNotification,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../services/notifications';
import { apiRequest, ApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import OptionCheckbox from './OptionCheckbox';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  alertasSaude: true,
  atualizacoesVinculo: true,
};

export default function PushNotificationsCard() {
  const userType = useAuthStore((state) => state.user?.tipo);
  const [status, setStatus] = useState<PermissionStatus | 'unknown'>('unknown');
  const [loadingAction, setLoadingAction] = useState<'enable' | 'test' | 'deliveries' | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void getNotificationPermission().then((permission) => setStatus(permission.status)).catch(() => setStatus('unknown'));
    void getNotificationPreferences()
      .then(({ preferencias }) => setPreferences(preferencias))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as preferências.'))
      .finally(() => setLoadingPreferences(false));
  }, []);

  async function changePreference(key: keyof NotificationPreferences, checked: boolean) {
    const previous = preferences;
    const next = { ...preferences, [key]: checked };
    setPreferences(next);
    setLoadingPreferences(true);
    setError('');
    try {
      const response = await updateNotificationPreferences({ [key]: checked });
      setPreferences(response.preferencias);
    } catch (requestError) {
      setPreferences(previous);
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar a preferência.');
    } finally {
      setLoadingPreferences(false);
    }
  }

  async function enable() {
    setLoadingAction('enable');
    setError('');
    try {
      await registerForPushNotifications(true);
      setStatus(PermissionStatus.GRANTED);
      Alert.alert('Notificações ativadas', 'Este aparelho poderá receber alertas do LifeGuard.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível ativar as notificações.');
      const permission = await getNotificationPermission().catch(() => null);
      if (permission) setStatus(permission.status);
    } finally {
      setLoadingAction(null);
    }
  }

  async function test() {
    setLoadingAction('test');
    setError('');
    try {
      if (userType !== 'idoso') await registerForPushNotifications(false);
      const result = await sendTestNotification();
      Alert.alert(
        'Teste enviado',
        result.destino === 'cuidadores'
          ? `A notificação foi enviada para ${result.enviadas} ${result.enviadas === 1 ? 'aparelho de cuidador' : 'aparelhos de cuidadores'}.`
          : 'A notificação deve aparecer neste aparelho em alguns segundos.',
      );
    } catch (requestError) {
      setError(requestError instanceof ApiError || requestError instanceof Error ? requestError.message : 'Não foi possível enviar o teste.');
    } finally {
      setLoadingAction(null);
    }
  }

  async function checkDeliveries() {
    setLoadingAction('deliveries');
    setError('');
    try {
      const { entregas } = await apiRequest<{ entregas: { status: string }[] }>('/notificacoes/entregas');
      if (!entregas.length) setDeliverySummary('Ainda não há envios registrados para sua conta.');
      else {
        const count = (status: string) => entregas.filter((item) => item.status === status).length;
        setDeliverySummary(`Últimos ${entregas.length} envios: ${count('accepted')} encaminhados, ${count('pending')} aguardando confirmação, ${count('failed')} com falha e ${count('unknown')} sem confirmação.`);
      }
    } catch (requestError) {
      setError(requestError instanceof ApiError && requestError.status === 404
        ? 'O histórico de entrega estará disponível após a atualização do servidor.'
        : 'Não foi possível consultar as entregas agora. Tente novamente.');
    } finally { setLoadingAction(null); }
  }

  const enabled = status === 'granted';
  const isPatient = userType === 'idoso';
  return (
    <Card style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>Notificações</Text>
        <Text style={styles.description}>{enabled ? 'Ativadas neste aparelho.' : 'Ative para receber alertas e avisos importantes.'}</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!enabled ? <AppButton label="Ativar notificações neste aparelho" icon="bell-outline" onPress={() => void enable()} loading={loadingAction === 'enable'} disabled={loadingAction !== null} /> : null}
      {enabled && !isPatient ? <AppButton label="Testar neste aparelho" icon="bell-ring-outline" variant="secondary" onPress={() => void test()} loading={loadingAction === 'test'} disabled={loadingAction !== null} /> : null}
      {isPatient ? <AppButton label="Enviar teste aos cuidadores" icon="bell-ring-outline" variant="secondary" style={!enabled ? styles.secondaryAction : undefined} onPress={() => void test()} loading={loadingAction === 'test'} disabled={loadingAction !== null} /> : null}
      {status === 'denied' ? <AppButton label="Abrir configurações do aparelho" variant="text" onPress={() => void Linking.openSettings()} disabled={loadingAction !== null} /> : null}
      <AppButton label="Consultar entregas da minha conta" variant="text" onPress={() => void checkDeliveries()} loading={loadingAction === 'deliveries'} disabled={loadingAction !== null} />
      {deliverySummary ? <View accessibilityLiveRegion="polite">
        <Text style={styles.description}>{deliverySummary}</Text>
        <Text style={styles.preferencesHelper}>A confirmação pode levar cerca de 15 minutos. Encaminhado significa aceito pelo serviço de notificações do celular; não comprova que a pessoa viu o aviso.</Text>
      </View> : null}
      <View style={styles.preferences}>
        <Text style={styles.preferencesTitle}>Quero receber</Text>
        <OptionCheckbox
          checked={preferences.alertasSaude}
          label={isPatient ? 'Alertas sobre meus sinais vitais' : 'Alertas de saúde dos pacientes'}
          onChange={(checked) => void changePreference('alertasSaude', checked)}
          disabled={loadingPreferences}
        />
        <OptionCheckbox
          checked={preferences.atualizacoesVinculo}
          label="Avisos sobre vínculos de cuidado"
          onChange={(checked) => void changePreference('atualizacoesVinculo', checked)}
          disabled={loadingPreferences}
        />
        <Text style={styles.preferencesHelper}>As escolhas valem para todos os seus aparelhos.</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 18 },
  copy: { marginBottom: 14 },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 3 },
  error: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.emberText, marginBottom: 12 },
  secondaryAction: { marginTop: 10 },
  preferences: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  preferencesTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 10 },
  preferencesHelper: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});
