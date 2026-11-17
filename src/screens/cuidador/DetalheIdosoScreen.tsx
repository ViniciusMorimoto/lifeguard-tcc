import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme/theme';
import BackHeader from '../../components/BackHeader';
import VitalCard from '../../components/VitalCard';
import StatusPill from '../../components/StatusPill';
import AppButton from '../../components/AppButton';
import Card from '../../components/Card';
import { useMonitoringStore } from '../../store/monitoringStore';
import { useFocusEffect } from '@react-navigation/native';
import { fetchElder } from '../../services/monitoring';
import { apiRequest, ApiError, formatDateTime } from '../../services/api';
import InlineNotice from '../../components/InlineNotice';
import { formatPhone } from '../../utils/phone';
import { formatGender } from '../../components/GenderSelector';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalheIdoso'>;

export default function DetalheIdosoScreen({ navigation, route }: Props) {
  const { idosoId, nome } = route.params;
  const elder = useMonitoringStore((state) => state.elders.find((item) => item.id === idosoId));
  const upsertElder = useMonitoringStore((state) => state.upsertElder);
  const setLimits = useMonitoringStore((state) => state.setLimits);
  const removeElder = useMonitoringStore((state) => state.removeElder);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const leitura = elder ?? { id: idosoId, nome, batimento: null, temperatura: null, status: 'sem_sinal' as const, ultimaAtualizacao: 'indisponível', telefone: '' };
  const profile = leitura.perfilIdoso;
  const emergencyContact = profile?.contatoEmergenciaNome && profile?.contatoEmergenciaTelefone
    ? `${profile.contatoEmergenciaNome} · ${formatPhone(profile.contatoEmergenciaTelefone)}`
    : 'Não informado';

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const result = await fetchElder(idosoId);
      upsertElder(result.elder);
      if (result.limits) setLimits(idosoId, result.limits);
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
  }, [idosoId, setLimits, upsertElder]);

  useFocusEffect(useCallback(() => {
    void refresh(true);
    const interval = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(interval);
  }, [refresh]));

  function handleRemove() {
    if (!leitura.vinculoId) {
      Alert.alert('Vínculo indisponível', 'Atualize a lista de pacientes e tente novamente.');
      return;
    }
    Alert.alert('Remover paciente', `Você deixará de acompanhar ${leitura.nome} e não verá mais seus dados. Deseja continuar?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try {
          await apiRequest(`/vinculos/${leitura.vinculoId}`, { method: 'DELETE' });
          removeElder(idosoId);
          navigation.popTo('HomeCuidador');
        } catch (error) {
          setErro(error instanceof ApiError ? error.message : 'Não foi possível remover o vínculo.');
        }
      } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title={nome} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.coral} />}>
        {erro && elder ? <InlineNotice tone="warning" message={erro} /> : null}
        {loadState === 'loading' && !elder ? <LoadingState message={`Carregando os dados de ${nome}...`} /> : loadState === 'error' && !elder ? (
          <EmptyState icon="cloud-alert-outline" title="Dados indisponíveis" message={erro} actionLabel="Tentar novamente" onAction={() => { setLoadState('loading'); void refresh(true); }} />
        ) : <>
        <Card style={styles.patientCard}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              {leitura.foto ? <Image source={{ uri: leitura.foto }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{nome.charAt(0).toUpperCase()}</Text>}
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.patientName}>{leitura.nome}</Text>
              <Text style={styles.patientLabel}>Informações importantes do paciente</Text>
            </View>
          </View>
          <View style={styles.infoGrid}>
            <PatientInfo icon="calendar-outline" label="Nascimento" value={formatBirthDate(profile?.dataNascimento)} />
            <PatientInfo icon="account-details-outline" label="Gênero" value={formatGender(leitura.genero)} />
            <PatientInfo icon="water-outline" label="Tipo sanguíneo" value={profile?.tipoSanguineo || 'Não informado'} />
            <PatientInfo icon="medical-bag" label="Condições médicas" value={profile?.condicoesMedicas || 'Não informado'} />
            <PatientInfo icon="allergy" label="Alergias" value={profile?.alergias || 'Não informado'} />
            <PatientInfo icon="pill" label="Medicamentos" value={profile?.medicamentos || 'Não informado'} />
            <PatientInfo icon="alert-circle-outline" label="Observações" value={profile?.observacoesImportantes || 'Não informado'} />
            <PatientInfo icon="account-alert-outline" label="Contato de emergência" value={emergencyContact} last />
          </View>
          {!profile ? <Text style={styles.emptyProfile}>O próprio paciente preenche estes dados em Meu perfil → Editar perfil.</Text> : null}
        </Card>
        <Card style={styles.header}>
          <View style={styles.statusCopy}><Text style={styles.statusTitle}>Monitoramento ativo</Text><Text style={styles.subSaudacao}>Último registro: {leitura.ultimaAtualizacao}</Text></View>
          <StatusPill status={leitura.status} />
        </Card>

        <View style={styles.readingsRow}>
          <VitalCard icon="heart-pulse" iconColor={colors.ember} value={leitura.batimento ?? '--'} unit="bpm" label="Batimento" showPulse />
          <VitalCard icon="thermometer" iconColor={colors.amber} value={leitura.temperatura ?? '--'} unit="°C" label="Temperatura" />
        </View>

        <AppButton
          label="Ver histórico completo"
          icon="chart-line"
          onPress={() => navigation.navigate('Historico', { idosoId, nome })}
          style={{ marginBottom: 12 }}
        />
        <AppButton
          label="Configurar limites de alerta"
          icon="tune-variant"
          variant="secondary"
          onPress={() => navigation.navigate('ConfigurarLimites', { idosoId, nome })}
          style={styles.action}
        />
        <AppButton
          label="Ver alterações do paciente"
          icon="history"
          variant="secondary"
          onPress={() => navigation.navigate('HistoricoAlteracoes', { idosoId, nome })}
          style={styles.action}
        />
        <AppButton label={`Falar com ${nome.split(' ')[0]}`} icon="phone-outline" variant="text" onPress={() => navigation.navigate('ContatoRapido', { idosoId, nome, telefone: leitura.telefone })} />
        <AppButton label="Remover dos meus cuidados" icon="account-remove-outline" variant="danger" onPress={handleRemove} style={styles.removeButton} />
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatBirthDate(value?: string | null) {
  if (!value) return 'Não informado';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : 'Não informado';
}

function PatientInfo({ icon, label, value, last }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; last?: boolean }) {
  return <View style={[styles.infoRow, !last && styles.infoBorder]}><MaterialCommunityIcons name={icon} size={20} color={colors.coral} /><View style={styles.infoCopy}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  patientCard: { marginBottom: 16 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontFamily: fonts.display, fontSize: 26, color: colors.sand },
  identityCopy: { flex: 1 },
  patientName: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  patientLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  infoGrid: { paddingTop: 4 },
  infoRow: { flexDirection: 'row', gap: 11, paddingVertical: 11 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoCopy: { flex: 1 },
  infoLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  infoValue: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 1 },
  emptyProfile: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary, backgroundColor: colors.coralSoft, borderRadius: 10, padding: 11, marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, paddingVertical: 16 },
  statusCopy: { flex: 1 },
  statusTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  subSaudacao: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 3 },
  readingsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  action: { marginTop: 12 },
  removeButton: { marginTop: 22 },
});
