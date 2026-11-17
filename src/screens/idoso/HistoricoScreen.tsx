import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryScatter } from 'victory-native';
import LifeGuardIcon from '../../components/LifeGuardIcon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radii } from '../../theme/theme';
import BackHeader from '../../components/BackHeader';
import SegmentedToggle from '../../components/SegmentedToggle';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import InlineNotice from '../../components/InlineNotice';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest, ApiError, formatDateTime } from '../../services/api';
import { fetchReadings, type Reading } from '../../services/monitoring';
import type { MonitoringAlert } from '../../store/monitoringStore';
import LoadingState from '../../components/LoadingState';

type Props = NativeStackScreenProps<RootStackParamList, 'Historico'>;

type Metrica = 'batimento' | 'temperatura';

export default function HistoricoScreen({ navigation, route }: Props) {
  const user = useAuthStore((state) => state.user);
  const elderId = route.params?.idosoId ?? user?.id;
  const nomeIdoso = route.params?.nome;
  const [metrica, setMetrica] = useState<Metrica>('batimento');
  const [leituras, setLeituras] = useState<Reading[]>([]);
  const [medias, setMedias] = useState<Reading[]>([]);
  const [picos, setPicos] = useState<MonitoringAlert[]>([]);
  const [erro, setErro] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  const loadHistory = useCallback(async (refresh = false) => {
    if (!elderId) return;
    if (refresh) setRefreshing(true);
    try {
      const [readings, averages, alerts] = await Promise.all([
        fetchReadings(elderId, 30, '10s'),
        fetchReadings(elderId, 168, '1h'),
        apiRequest<{ alertas: Array<Omit<MonitoringAlert, 'horario'> & { horario: string }> }>('/alertas'),
      ]);
      setLeituras(readings);
      setMedias(averages);
      setPicos(alerts.alertas.filter((alert) => alert.idosoId === elderId).map((alert) => ({ ...alert, horario: formatDateTime(alert.horario) })));
      setErro('');
      setLoadState('ready');
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível carregar o histórico.');
      setLoadState('error');
    } finally {
      setRefreshing(false);
    }
  }, [elderId]);

  const refreshChart = useCallback(async () => {
    if (!elderId) return;
    try {
      setLeituras(await fetchReadings(elderId, 30, '10s'));
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível atualizar o gráfico.');
    }
  }, [elderId]);

  useFocusEffect(useCallback(() => {
    void loadHistory();
    const chartInterval = setInterval(() => void refreshChart(), 10_000);
    const historyInterval = setInterval(() => void loadHistory(), 300_000);
    return () => {
      clearInterval(chartInterval);
      clearInterval(historyInterval);
    };
  }, [loadHistory, refreshChart]));

  const pontos = useMemo(() => leituras
    .filter((reading) => reading.valida && (metrica === 'batimento'
      ? reading.batimento !== null && reading.batimento >= 30 && reading.batimento <= 250
      : reading.temperatura !== null))
    .map((reading) => ({
      x: new Date(reading.horario).getTime(),
      y: metrica === 'batimento' ? reading.batimento! : reading.temperatura!,
      horario: reading.horario,
    })), [leituras, metrica]);
  const mediasFiltradas = medias.filter((reading) => reading.valida && (metrica === 'batimento'
    ? reading.batimento !== null && reading.batimento >= 30 && reading.batimento <= 250
    : reading.temperatura !== null));
  const unidade = metrica === 'batimento' ? 'bpm' : '°C';
  const extremos = leituras.filter((reading) => reading.valida).flatMap((reading) => metrica === 'batimento'
    ? [reading.batimentoMinimo, reading.batimentoMaximo]
    : [reading.temperaturaMinima, reading.temperaturaMaxima]).filter((value): value is number => value !== null && value !== undefined);
  const picosFiltrados = picos.filter((pico) => pico.tipo === metrica
    && (metrica !== 'batimento' || (pico.valor >= 30 && pico.valor <= 250)));
  const values = pontos.map((point) => point.y);
  const media = values.length ? (values.reduce((total, value) => total + value, 0) / values.length).toFixed(metrica === 'batimento' ? 0 : 1) : '--';
  const tickCount = Math.min(pontos.length, Math.max(2, Math.floor(chartWidth / 65)));
  const chartEnd = Date.now();
  const chartStart = chartEnd - 5 * 60_000;
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    tickCount === 1 ? chartEnd : chartStart + Math.round(index * (chartEnd - chartStart) / (tickCount - 1)));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title={nomeIdoso ? `Histórico de ${nomeIdoso}` : 'Histórico'} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadHistory(true)} tintColor={colors.coral} />}>
        {erro && (leituras.length > 0 || medias.length > 0 || picos.length > 0) ? <InlineNotice tone="warning" message={erro} /> : null}
        {loadState === 'loading' && leituras.length === 0 && medias.length === 0 && picos.length === 0 ? <LoadingState message="Carregando histórico de saúde..." /> : loadState === 'error' && leituras.length === 0 && medias.length === 0 && picos.length === 0 ? (
          <EmptyState icon="cloud-alert-outline" title="Histórico indisponível" message={erro} actionLabel="Tentar novamente" onAction={() => { setLoadState('loading'); void loadHistory(); }} />
        ) : <>
        <SegmentedToggle
          value={metrica}
          onChange={setMetrica}
          options={[
            { value: 'batimento', label: 'Batimento' },
            { value: 'temperatura', label: 'Temperatura' },
          ]}
        />

        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.summary}><Text style={styles.chartLabel}>Últimos 5 minutos</Text><Text style={styles.average}>{media} <Text style={styles.unit}>{unidade}</Text></Text></View>
            <View style={styles.range}><Text style={styles.rangeText}>{extremos.length ? `mín. ${Math.min(...extremos)} · máx. ${Math.max(...extremos)}` : 'sem dados'}</Text></View>
          </View>
          <View style={styles.chartViewport} onLayout={({ nativeEvent }) => setChartWidth(Math.floor(nativeEvent.layout.width))}>
          {pontos.length === 0 ? <Text style={styles.noReadings}>Ainda não há leituras válidas para esta métrica.</Text> : chartWidth > 0 ? <VictoryChart width={chartWidth} height={200} padding={{ top: 16, bottom: 30, left: 44, right: 16 }} domainPadding={{ x: 0, y: 12 }} domain={{ x: [chartStart, chartEnd], ...(metrica === 'batimento' ? { y: [0, 250] as [number, number] } : {}) }}>
            <VictoryAxis
              style={{
                axis: { stroke: colors.border },
                tickLabels: { fontFamily: fonts.body, fontSize: 10, fill: colors.textSecondary },
                grid: { stroke: 'transparent' },
              }}
              tickFormat={(tick) => new Date(tick).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              tickValues={ticks}
            />
            <VictoryAxis
              dependentAxis
              style={{
                axis: { stroke: 'transparent' },
                tickLabels: { fontFamily: fonts.body, fontSize: 10, fill: colors.textSecondary },
                grid: { stroke: colors.border, strokeDasharray: '2,4' },
              }}
            />
            <VictoryLine
              data={pontos}
              interpolation="monotoneX"
              style={{ data: { stroke: colors.coral, strokeWidth: 2.5 } }}
            />
            <VictoryScatter data={pontos} size={3} style={{ data: { fill: colors.ink } }} />
          </VictoryChart> : null}
          </View>
          {pontos.length > 0 ? <Text style={styles.chartCaption}>Janela de 5 minutos · pontos médios a cada 10 segundos</Text> : null}
        </Card>

        <Text style={styles.sectionTitle}>Médias por hora</Text>
        {mediasFiltradas.length === 0 ? <Text style={styles.noReadings}>Ainda não há médias disponíveis para esta métrica.</Text> : mediasFiltradas.map((reading) => (
          <Card key={reading.id} style={styles.averageCard}>
            <View style={styles.averageInfo}>
              <Text style={styles.averageValue}>
                Média {metrica === 'batimento' ? reading.batimento : reading.temperatura?.toFixed(1)} {unidade}
              </Text>
              <Text style={styles.averageExtremes}>
                Mín. {metrica === 'batimento' ? reading.batimentoMinimo ?? '--' : reading.temperaturaMinima?.toFixed(1) ?? '--'} · Máx. {metrica === 'batimento' ? reading.batimentoMaximo ?? '--' : reading.temperaturaMaxima?.toFixed(1) ?? '--'} {unidade}
              </Text>
            </View>
            <Text style={styles.averageTime}>{formatDateTime(reading.horario)}</Text>
          </Card>
        ))}

        <Text style={styles.sectionTitle}>Picos registrados</Text>

        {picosFiltrados.length === 0 ? <EmptyState icon="chart-line" title="Nenhum pico registrado" message="Os alertas reais aparecerão aqui quando uma leitura válida ultrapassar os limites." /> : picosFiltrados.map((pico) => (
          <Card key={pico.id} style={styles.picoCard}>
            <View style={styles.picoIcon}>
              <LifeGuardIcon
                name={pico.tipo === 'batimento' ? 'heart-pulse' : 'thermometer'}
                size={20}
                color={colors.inkSoft}
              />
            </View>
            <View style={styles.picoInfo}>
              <Text style={styles.picoValor}>
                {pico.valor} {pico.tipo === 'batimento' ? 'bpm' : '°C'}
              </Text>
              <Text style={styles.picoHorario}>{pico.horario}</Text>
            </View>
          </Card>
        ))}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  chartCard: { marginBottom: 24, paddingBottom: 16, minWidth: 0 },
  chartViewport: { width: '100%', overflow: 'hidden' },
  chartHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  summary: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 },
  chartCaption: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  noReadings: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 36 },
  chartLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  average: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, marginTop: 3 },
  unit: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  range: { maxWidth: '100%', flexShrink: 1, backgroundColor: colors.sand, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  rangeText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, marginBottom: 12 },
  averageCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, paddingVertical: 14 },
  averageInfo: { flex: 1, gap: 3 },
  averageValue: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  averageExtremes: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  averageTime: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, textAlign: 'right' },
  picoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, paddingVertical: 14 },
  picoIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  picoInfo: { flex: 1 },
  picoValor: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  picoHorario: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
});
