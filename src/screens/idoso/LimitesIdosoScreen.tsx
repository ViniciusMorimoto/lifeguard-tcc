import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme/theme';
import BackHeader from '../../components/BackHeader';
import Card from '../../components/Card';
import InlineNotice from '../../components/InlineNotice';
import { useMonitoringStore } from '../../store/monitoringStore';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { fetchLimits } from '../../services/monitoring';
import { ApiError } from '../../services/api';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';

type Props = NativeStackScreenProps<RootStackParamList, 'LimitesIdoso'>;

export default function LimitesIdosoScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const limits = useMonitoringStore((state) => user ? state.limitsByElder[user.id] : undefined);
  const setLimits = useMonitoringStore((state) => state.setLimits);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLimits = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setLimits(user.id, await fetchLimits(user.id));
      setErro('');
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível carregar os limites.');
    } finally {
      setLoading(false);
    }
  }, [setLimits, user]);

  useFocusEffect(useCallback(() => { void loadLimits(); }, [loadLimits]));

  if (!limits) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <BackHeader title="Meus limites de alerta" onBack={() => navigation.goBack()} />
        {loading ? <LoadingState message="Carregando limites de alerta..." /> : (
          <EmptyState icon="cloud-alert-outline" title="Limites indisponíveis" message={erro || 'Não encontramos os limites de alerta.'} actionLabel="Tentar novamente" onAction={() => void loadLimits()} />
        )}
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Meus limites de alerta" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        {erro ? <InlineNotice tone="warning" message={erro} /> : null}
        <InlineNotice message="Para sua segurança, somente seus cuidadores podem alterar estes valores." />
        <Text style={styles.sectionTitle}>Faixas configuradas</Text>
        <LimitCard icon="heart-pulse" title="Batimento cardíaco" min={limits.batimentoMin} max={limits.batimentoMax} unit="bpm" color={colors.ember} />
        <LimitCard icon="thermometer" title="Temperatura corporal" min={limits.temperaturaMin} max={limits.temperaturaMax} unit="°C" color={colors.amber} />
        <Text style={styles.updated}>Última alteração por {limits.updatedBy} em {limits.updatedAt}.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function LimitCard({ icon, title, min, max, unit, color }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; min: number; max: number; unit: string; color: string }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}><View style={styles.icon}><MaterialCommunityIcons name={icon} size={24} color={color} /></View><Text style={styles.cardTitle}>{title}</Text></View>
      <View style={styles.values}>
        <View style={styles.valueBlock}><Text style={styles.valueLabel}>Mínimo</Text><Text style={styles.value}>{min} <Text style={styles.unit}>{unit}</Text></Text></View>
        <View style={styles.divider} />
        <View style={styles.valueBlock}><Text style={styles.valueLabel}>Máximo</Text><Text style={styles.value}>{max} <Text style={styles.unit}>{unit}</Text></Text></View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, marginTop: 12 },
  card: { gap: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  values: { flexDirection: 'row', alignItems: 'stretch' },
  valueBlock: { flex: 1 },
  valueLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  value: { fontFamily: fonts.display, fontSize: 25, color: colors.ink, marginTop: 4 },
  unit: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  divider: { width: 1, backgroundColor: colors.border, marginHorizontal: 18 },
  updated: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
});
