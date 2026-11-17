import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme/theme';
import BackHeader from '../../components/BackHeader';
import AppTextInput from '../../components/AppTextInput';
import AppButton from '../../components/AppButton';
import Card from '../../components/Card';
import { useMonitoringStore } from '../../store/monitoringStore';
import { useFocusEffect } from '@react-navigation/native';
import { fetchLimits, saveLimits } from '../../services/monitoring';
import { ApiError } from '../../services/api';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfigurarLimites'>;

export default function ConfigurarLimitesScreen({ navigation, route }: Props) {
  const { idosoId, nome } = route.params;
  const savedLimits = useMonitoringStore((state) => state.limitsByElder[idosoId]);
  const setLimits = useMonitoringStore((state) => state.setLimits);

  const [batimentoMin, setBatimentoMin] = useState(String(savedLimits?.batimentoMin ?? 60));
  const [batimentoMax, setBatimentoMax] = useState(String(savedLimits?.batimentoMax ?? 120));
  const [temperaturaMin, setTemperaturaMin] = useState(String(savedLimits?.temperaturaMin ?? 35.5));
  const [temperaturaMax, setTemperaturaMax] = useState(String(savedLimits?.temperaturaMax ?? 37.8));
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(savedLimits ? 'ready' : 'loading');

  const loadLimits = useCallback(async () => {
    try {
      const limits = await fetchLimits(idosoId);
      setLimits(idosoId, limits);
      setBatimentoMin(String(limits.batimentoMin));
      setBatimentoMax(String(limits.batimentoMax));
      setTemperaturaMin(String(limits.temperaturaMin));
      setTemperaturaMax(String(limits.temperaturaMax));
      setErro('');
      setLoadState('ready');
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível carregar os limites.');
      setLoadState('error');
    }
  }, [idosoId, setLimits]);

  useFocusEffect(useCallback(() => { void loadLimits(); }, [loadLimits]));

  async function handleSalvar() {
    const values = [batimentoMin, batimentoMax, temperaturaMin, temperaturaMax].map((value) => Number(value.replace(',', '.')));
    if (values.some((value) => !Number.isFinite(value))) {
      setErro('Preencha todos os limites com números válidos.');
      return;
    }
    if (values[0] >= values[1] || values[2] >= values[3]) {
      setErro('O valor mínimo precisa ser menor que o máximo.');
      return;
    }
    setLoading(true);
    try {
      const input = { batimentoMin: values[0], batimentoMax: values[1], temperaturaMin: values[2], temperaturaMax: values[3] };
      const saved = await saveLimits(idosoId, input);
      setLimits(idosoId, saved);
      setErro('');
      Alert.alert('Limites salvos', `Novos limites de alerta definidos para ${nome}.`);
      navigation.goBack();
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível salvar os limites.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Limites de alerta" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {loadState === 'loading' && !savedLimits ? <LoadingState message="Carregando limites atuais..." /> : loadState === 'error' && !savedLimits ? (
          <EmptyState icon="cloud-alert-outline" title="Limites indisponíveis" message={erro} actionLabel="Tentar novamente" onAction={() => { setLoadState('loading'); void loadLimits(); }} />
        ) : <>
          <Text style={styles.subtitulo}>Definindo os alertas de {nome}</Text>

        <Card style={styles.card}>
          <Text style={styles.grupoLabel}>Batimento cardíaco (bpm)</Text>
          <View style={styles.row}>
            <AppTextInput label="Mínimo" value={batimentoMin} onChangeText={(value) => { setBatimentoMin(value); setErro(''); }} keyboardType="decimal-pad" containerStyle={styles.field} />
            <AppTextInput label="Máximo" value={batimentoMax} onChangeText={(value) => { setBatimentoMax(value); setErro(''); }} keyboardType="decimal-pad" containerStyle={styles.field} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.grupoLabel}>Temperatura (°C)</Text>
          <View style={styles.row}>
            <AppTextInput label="Mínima" value={temperaturaMin} onChangeText={(value) => { setTemperaturaMin(value); setErro(''); }} keyboardType="decimal-pad" containerStyle={styles.field} />
            <AppTextInput label="Máxima" value={temperaturaMax} onChangeText={(value) => { setTemperaturaMax(value); setErro(''); }} keyboardType="decimal-pad" containerStyle={styles.field} />
          </View>
        </Card>

        {erro ? <Text accessibilityRole="alert" style={styles.erro}>{erro}</Text> : null}
        <AppButton label="Salvar limites" icon="content-save-outline" onPress={handleSalvar} loading={loading} style={styles.save} />
        </>}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  flex: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  subtitulo: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  card: { marginBottom: 16 },
  grupoLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  erro: { fontFamily: fonts.body, fontSize: 14, color: colors.emberText, marginBottom: 12 },
  save: { marginTop: 4 },
});
