import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import BackHeader from '../components/BackHeader';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import InlineNotice from '../components/InlineNotice';
import { colors, fonts } from '../theme/theme';
import { ApiError, formatDateTime } from '../services/api';
import { fetchPatientChanges, type PatientChange } from '../services/monitoring';
import LoadingState from '../components/LoadingState';

type Props = NativeStackScreenProps<RootStackParamList, 'HistoricoAlteracoes'>;

const fieldLabels: Record<string, string> = {
  nome: 'nome',
  email: 'e-mail',
  telefone: 'telefone',
  genero: 'gênero',
  foto: 'foto de perfil',
  data_nascimento: 'data de nascimento',
  tipo_sanguineo: 'tipo sanguíneo',
  alergias: 'alergias',
  medicamentos: 'medicamentos em uso',
  condicoes_medicas: 'condições médicas',
  observacoes_importantes: 'observações importantes',
  contato_emergencia_nome: 'nome do contato de emergência',
  contato_emergencia_telefone: 'telefone do contato de emergência',
  batimento_minimo: 'batimento mínimo',
  batimento_maximo: 'batimento máximo',
  temperatura_minima: 'temperatura mínima',
  temperatura_maxima: 'temperatura máxima',
};

export default function HistoricoAlteracoesScreen({ navigation, route }: Props) {
  const { idosoId, nome } = route.params;
  const [changes, setChanges] = useState<PatientChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setChanges(await fetchPatientChanges(idosoId));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível carregar o histórico de alterações.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idosoId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Alterações do paciente" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.coral} />}
      >
        <Text style={styles.subtitle}>Registro das informações importantes de {nome} e de quem realizou cada alteração.</Text>
        <InlineNotice message="Por privacidade, o histórico informa quais campos mudaram, mas não exibe os valores anteriores." />
        {error && changes.length > 0 ? <InlineNotice tone="warning" message={error} /> : null}
        {loading ? (
          <LoadingState message="Carregando alterações..." />
        ) : changes.length === 0 ? (
          <EmptyState
            icon={error ? 'cloud-alert-outline' : 'history'}
            title={error ? 'Histórico indisponível' : 'Nenhuma alteração registrada'}
            message={error || 'As próximas mudanças no perfil e nos limites de alerta aparecerão aqui.'}
            actionLabel={error ? 'Tentar novamente' : undefined}
            onAction={error ? () => void load() : undefined}
          />
        ) : (
          <View style={styles.list}>
            {changes.map((change) => <ChangeCard key={change.id} change={change} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChangeCard({ change }: { change: PatientChange }) {
  const isLimits = change.categoria === 'limites';
  const actor = change.alteradoPor
    ? `${change.alteradoPor.nome} (${change.alteradoPor.tipo})`
    : 'Conta anteriormente autorizada';
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name={isLimits ? 'tune-variant' : 'account-edit-outline'} size={23} color={colors.coral} />
        </View>
        <View style={styles.cardTitleCopy}>
          <Text style={styles.cardTitle}>{isLimits ? 'Limites de alerta' : 'Perfil do paciente'}</Text>
          <Text style={styles.date}>{formatDateTime(change.alteradoEm)}</Text>
        </View>
      </View>
      <Text style={styles.label}>Campos alterados</Text>
      <Text style={styles.fields}>{change.campos.map((field) => fieldLabels[field] ?? field).join(', ')}</Text>
      <View style={styles.actorRow}>
        <MaterialCommunityIcons name="account-check-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.actor}>Alterado por {actor}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginBottom: 2 },
  list: { gap: 12 },
  card: { gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitleCopy: { flex: 1 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  date: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  fields: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: -8 },
  actorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 11 },
  actor: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
