import { useCallback, useState } from 'react';
import { Alert, AppState, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme/theme';
import BackHeader from '../../components/BackHeader';
import Card from '../../components/Card';
import AppButton from '../../components/AppButton';
import InlineNotice from '../../components/InlineNotice';
import LoadingState from '../../components/LoadingState';
import { apiRequest, ApiError, formatDateTime } from '../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'MeuDispositivo'>;
type Device = { id: string; nickname: string; lastSeenAt: string | null; conectado: boolean };

export default function MeuDispositivoScreen({ navigation }: Props) {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ dispositivo: Device | null }>('/dispositivos/me');
      setDevice(result.dispositivo);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível consultar o dispositivo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [load]));

  function revoke() {
    Alert.alert(
      'Desconectar dispositivo?',
      'A credencial será revogada e o ESP32 não poderá mais enviar leituras. O histórico será preservado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await apiRequest('/dispositivos/me', { method: 'DELETE' });
              await load();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : 'Não foi possível desconectar.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Meu dispositivo" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} />}
      >
        {error ? <InlineNotice tone="warning" message={error} /> : null}
        {loading && !device ? <LoadingState message="Consultando dispositivo..." /> : (
          <>
            <Card>
              <Text style={styles.heading}>
                {error ? 'Estado indisponível' : device?.conectado ? 'Sinal recebido' : device ? 'Aguardando sinal' : 'Nenhum dispositivo configurado'}
              </Text>
              <Text style={styles.text}>{device ? device.nickname : 'Configure seu ESP32 para começar a receber leituras.'}</Text>
              {device ? <Text style={styles.text}>Último contato: {device.lastSeenAt ? formatDateTime(device.lastSeenAt) : 'ainda não recebido'}</Text> : null}
            </Card>

            <InlineNotice message="A conexão indica comunicação recente com o servidor, não a precisão do sensor. Após 90 segundos sem sinal, o dispositivo aparece desconectado." />
            {device ? <AppButton
              label="Alterar rede Wi-Fi"
              icon="wifi-cog"
              variant="secondary"
              onPress={() => navigation.navigate('ParearDispositivo', { trocarRede: true })}
              disabled={busy}
            /> : null}
            <AppButton
              label={device ? 'Preparar outro dispositivo' : 'Preparar dispositivo'}
              icon="link-variant"
              onPress={() => navigation.navigate('ParearDispositivo')}
              disabled={busy}
            />
            {device ? <AppButton label="Desconectar dispositivo" variant="secondary" onPress={revoke} loading={busy} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  heading: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink },
  text: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 10 },
});
