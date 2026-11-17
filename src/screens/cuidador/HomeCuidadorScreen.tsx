import { useCallback, useState } from 'react';
import { Image, ScrollView, View, Text, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radii } from '../../theme/theme';
import StatusPill from '../../components/StatusPill';
import HomeHeader from '../../components/HomeHeader';
import SectionHeader from '../../components/SectionHeader';
import { useMonitoringStore } from '../../store/monitoringStore';
import { useFocusEffect } from '@react-navigation/native';
import { fetchCaregiverDashboard } from '../../services/monitoring';
import { ApiError, formatDateTime } from '../../services/api';
import InlineNotice from '../../components/InlineNotice';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';

type Props = NativeStackScreenProps<RootStackParamList, 'HomeCuidador'>;

export default function HomeCuidadorScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const idosos = useMonitoringStore((state) => state.elders);
  const alertCount = useMonitoringStore((state) => state.alerts.filter((alert) => alert.status === 'novo').length);
  const setElders = useMonitoringStore((state) => state.setElders);
  const setAlerts = useMonitoringStore((state) => state.setAlerts);
  const [refreshing, setRefreshing] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [erro, setErro] = useState('');

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const dashboard = await fetchCaregiverDashboard();
      setElders(dashboard.elders);
      setAlerts(dashboard.alerts);
      setErro(dashboard.cache.fromCache
        ? `Sem conexão. Exibindo os últimos dados salvos em ${formatDateTime(dashboard.cache.savedAt!)}.`
        : '');
      setLoadState('ready');
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível atualizar os dados.');
      setLoadState('error');
    } finally {
      setRefreshing(false);
    }
  }, [setAlerts, setElders]);

  useFocusEffect(useCallback(() => {
    void refresh(true);
    const interval = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(interval);
  }, [refresh]));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.coral} />}>
        <HomeHeader
          title={`Olá, ${(user?.nome ?? 'Cuidador').split(' ')[0]}`}
          subtitle={idosos.length === 1 ? '1 pessoa sob seus cuidados' : `${idosos.length} pessoas sob seus cuidados`}
          photo={user?.foto}
          accountType="cuidador"
          onProfile={() => navigation.navigate('Perfil')}
          onNotifications={() => navigation.navigate('Alertas')}
          notificationCount={alertCount}
        />

        {erro && idosos.length > 0 ? <InlineNotice tone="warning" message={erro} /> : null}

        <SectionHeader title="Pessoas acompanhadas" actionLabel="Ver alertas" onAction={() => navigation.navigate('Alertas')} />

        {loadState === 'loading' && idosos.length === 0 ? (
          <LoadingState message="Carregando pessoas acompanhadas..." />
        ) : loadState === 'error' && idosos.length === 0 ? (
          <EmptyState icon="cloud-alert-outline" title="Não foi possível carregar" message={erro} actionLabel="Tentar novamente" onAction={() => { setLoadState('loading'); void refresh(true); }} />
        ) : idosos.length === 0 ? (
          <EmptyState
            icon="account-heart-outline"
            title="Sua rede começa aqui"
            message="Vincule a conta de um paciente com o código temporário fornecido por ele."
            actionLabel="Vincular primeiro paciente"
            onAction={() => navigation.navigate('VincularIdoso')}
          />
        ) : idosos.map((idoso) => (
          <Pressable
            key={idoso.id}
            accessibilityRole="button"
            accessibilityLabel={`${idoso.nome}, status ${idoso.status}, ${idoso.batimento ?? 'sem leitura'} batimentos por minuto, ${idoso.temperatura ?? 'sem leitura'} graus`}
            style={({ pressed }) => [styles.idosoCard, pressed && styles.pressed]}
            onPress={() => navigation.navigate('DetalheIdoso', { idosoId: idoso.id, nome: idoso.nome })}
          >
            <View style={styles.avatar}>
              {idoso.foto ? <Image source={{ uri: idoso.foto }} style={styles.avatarImage} /> : <Text style={styles.avatarLabel}>{idoso.nome.charAt(0)}</Text>}
            </View>
            <View style={styles.idosoInfo}>
              <Text style={styles.idosoNome}>{idoso.nome}</Text>
              <Text style={styles.idosoLeitura}>{idoso.batimento ?? '--'} bpm · {idoso.temperatura ?? '--'}°C</Text>
            </View>
            <StatusPill status={idoso.status} />
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
          </Pressable>
        ))}
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Vincular paciente" style={({ pressed }) => [styles.fab, pressed && styles.pressed]} onPress={() => navigation.navigate('VincularIdoso')}>
        <MaterialCommunityIcons name="plus" size={20} color={colors.sand} />
        <Text style={styles.fabLabel}>Vincular paciente</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { padding: 20, paddingBottom: 100 },
  idosoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.cardBg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12, minHeight: 82 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 22 },
  avatarLabel: { fontFamily: fonts.bodyBold, color: colors.sand, fontSize: 16 },
  idosoInfo: { flex: 1 },
  idosoNome: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  idosoLeitura: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 3 },
  fab: { position: 'absolute', right: 16, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 20, height: 52 },
  fabLabel: { fontFamily: fonts.bodyBold, color: colors.sand, fontSize: 14 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
