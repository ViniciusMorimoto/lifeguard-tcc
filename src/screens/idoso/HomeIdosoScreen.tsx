import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, View, Text, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, radii } from '../../theme/theme';
import VitalCard from '../../components/VitalCard';
import StatusPill from '../../components/StatusPill';
import HomeHeader from '../../components/HomeHeader';
import Card from '../../components/Card';
import SectionHeader from '../../components/SectionHeader';
import { useMonitoringStore } from '../../store/monitoringStore';
import { useFocusEffect } from '@react-navigation/native';
import { fetchElder } from '../../services/monitoring';
import { ApiError, formatDateTime } from '../../services/api';
import InlineNotice from '../../components/InlineNotice';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';
import LifeGuardIcon from '../../components/LifeGuardIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'HomeIdoso'>;

export default function HomeIdosoScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const leitura = useMonitoringStore((state) => state.elders.find((elder) => elder.id === user?.id));
  const upsertElder = useMonitoringStore((state) => state.upsertElder);
  const setLimits = useMonitoringStore((state) => state.setLimits);
  const [refreshing, setRefreshing] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [erro, setErro] = useState('');

  const refresh = useCallback(async (showSpinner = false) => {
    if (!user) return;
    if (showSpinner) setRefreshing(true);
    try {
      const result = await fetchElder(user.id);
      upsertElder(result.elder);
      if (result.limits) setLimits(user.id, result.limits);
      setErro(result.cache.fromCache
        ? `Sem conexão. Exibindo os últimos dados salvos em ${formatDateTime(result.cache.savedAt!)}.`
        : '');
      setLoadState('ready');
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível atualizar os dados.');
      setLoadState('error');
    } finally {
      setRefreshing(false);
    }
  }, [setLimits, upsertElder, user]);

  useFocusEffect(useCallback(() => {
    void refresh(true);
    const interval = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(interval);
  }, [refresh]));

  const status = leitura?.status ?? 'sem_sinal';

  const acessos = [
    { icon: 'chart-line' as const, label: 'Histórico', onPress: () => navigation.navigate('Historico') },
    { icon: 'devices' as const, label: 'Meu dispositivo', onPress: () => navigation.navigate('MeuDispositivo') },
    { icon: 'account-group' as const, label: 'Cuidadores', onPress: () => navigation.navigate('Cuidadores') },
    { icon: 'tune-variant' as const, label: 'Limites de alerta', onPress: () => navigation.navigate('LimitesIdoso') },
  ];

  function handleSos() {
    Alert.alert('Emergência', 'Deseja ligar para o SAMU (192)?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ligar 192', style: 'destructive', onPress: () => Linking.openURL('tel:192') },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.coral} />}>
        <HomeHeader title={`Olá, ${(user?.nome ?? 'Usuário').split(' ')[0]}`} subtitle="Seu cuidado está sendo acompanhado" photo={user?.foto} accountType="idoso" onProfile={() => navigation.navigate('Perfil')} />

        {erro && leitura ? <InlineNotice tone="warning" message={erro} /> : null}

        {loadState === 'loading' && !leitura ? <LoadingState message="Carregando seu monitoramento..." /> : loadState === 'error' && !leitura ? (
          <EmptyState icon="cloud-alert-outline" title="Monitoramento indisponível" message={erro} actionLabel="Tentar novamente" onAction={() => { setLoadState('loading'); void refresh(true); }} />
        ) : <><Card style={styles.statusCard}>
          <View style={styles.statusCopy}><Text style={styles.statusTitle}>{status === 'normal' ? 'Tudo bem por aqui' : status === 'sem_sinal' ? 'Aguardando sinal' : 'Atenção aos seus sinais'}</Text><Text style={styles.statusSubtitle}>Último registro: {leitura?.ultimaAtualizacao ?? 'nenhum registro'}</Text></View>
          <StatusPill status={status} />
        </Card>

        <View style={styles.readingsRow}>
          <VitalCard icon="heart-pulse" iconColor={colors.ember} value={leitura?.batimento ?? '--'} unit="bpm" label="Batimento" showPulse />
          <VitalCard icon="thermometer" iconColor={colors.amber} value={leitura?.temperatura ?? '--'} unit="°C" label="Temperatura" />
        </View>
        </>}

        <SectionHeader title="Acesso rápido" />
        <View style={styles.grid}>
          {acessos.map((item) => (
            <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} style={({ pressed }) => [styles.gridItem, pressed && styles.pressed]} onPress={item.onPress}>
                <LifeGuardIcon name={item.icon} size={30} />
                <Text style={styles.gridLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Emergência, ligar para o SAMU" style={({ pressed }) => [styles.sos, pressed && styles.pressed]} onPress={handleSos}>
          <LifeGuardIcon name="sos" size={26} color={colors.white} />
          <Text style={styles.sosLabel}>Emergência (SOS)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { padding: 20, paddingBottom: 40 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingVertical: 16 },
  statusCopy: { flex: 1 },
  statusTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  statusSubtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 3 },
  readingsRow: { flexDirection: 'row', gap: 12, marginBottom: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  gridItem: { width: '47%', flexGrow: 1, minHeight: 112, backgroundColor: colors.cardBg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 9 },
  gridLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textPrimary, textAlign: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  sos: { flexDirection: 'row', backgroundColor: colors.inkSoft, borderRadius: radii.lg, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 },
  sosLabel: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.sand },
});
