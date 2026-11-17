import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Linking, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme/theme';
import BackHeader from '../../components/BackHeader';
import Card from '../../components/Card';
import AppButton from '../../components/AppButton';
import InlineNotice from '../../components/InlineNotice';
import { useMonitoringStore } from '../../store/monitoringStore';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest, ApiError } from '../../services/api';
import { fetchCaregivers } from '../../services/monitoring';
import { formatPhone, phoneUri } from '../../utils/phone';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';

type Props = NativeStackScreenProps<RootStackParamList, 'Cuidadores'>;

export default function CuidadoresScreen({ navigation }: Props) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const cuidadores = useMonitoringStore((state) => state.caregivers);
  const removeCaregiver = useMonitoringStore((state) => state.removeCaregiver);
  const setCaregivers = useMonitoringStore((state) => state.setCaregivers);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const loadCaregivers = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const result = await fetchCaregivers();
      setCaregivers(result);
      setErro('');
      setLoadState('ready');
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível carregar os cuidadores.');
      setLoadState('error');
    } finally {
      setRefreshing(false);
    }
  }, [setCaregivers]);

  useFocusEffect(useCallback(() => { void loadCaregivers(); }, [loadCaregivers]));

  async function handleGerarCodigo() {
    setLoading(true);
    try {
      const response = await apiRequest<{ codigo: string }>('/vinculos/codigo', { method: 'POST' });
      setCodigo(response.codigo);
      setErro('');
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível gerar o código.');
    } finally {
      setLoading(false);
    }
  }

  function handleRemover(id: string, nome: string) {
    Alert.alert('Remover cuidador', `Remover ${nome} da sua lista de cuidadores?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try {
          await apiRequest(`/vinculos/${id}`, { method: 'DELETE' });
          removeCaregiver(id);
          setErro('');
        } catch (error) {
          setErro(error instanceof ApiError ? error.message : 'Não foi possível remover o vínculo.');
        }
      } },
    ]);
  }

  function handleLigar(nome: string, telefone: string) {
    const uri = phoneUri(telefone);
    if (!uri) {
      Alert.alert('Telefone indisponível', `${nome} ainda não possui um telefone cadastrado.`);
      return;
    }
    Alert.alert(`Ligar para ${nome}?`, formatPhone(telefone), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ligar', onPress: () => void Linking.openURL(uri) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Cuidadores" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadCaregivers(true)} tintColor={colors.coral} />}>
        <InlineNotice message="Somente pessoas com um código válido podem se vincular à sua conta." />
        {erro && cuidadores.length > 0 ? <InlineNotice tone="warning" message={erro} /> : null}
        <AppButton label={codigo ? 'Gerar novo código' : 'Gerar código de vínculo'} icon="account-plus-outline" onPress={handleGerarCodigo} loading={loading} style={styles.generateButton} />

        {codigo ? (
          <Card style={styles.codeCard}>
            <Text style={styles.codeLabel}>Seu código temporário</Text>
            <Text accessibilityLabel={`Código ${codigo.split('').join(' ')}`} style={styles.code}>{codigo}</Text>
            <Text style={styles.codeHint}>Válido por 15 minutos · compartilhe apenas com alguém de confiança</Text>
          </Card>
        ) : null}

        <Text accessibilityRole="header" style={styles.sectionTitle}>Vinculados a você</Text>

        {loadState === 'loading' && cuidadores.length === 0 ? <LoadingState message="Carregando cuidadores..." /> : loadState === 'error' && cuidadores.length === 0 ? (
          <EmptyState icon="cloud-alert-outline" title="Cuidadores indisponíveis" message={erro} actionLabel="Tentar novamente" onAction={() => { setLoadState('loading'); void loadCaregivers(); }} />
        ) : cuidadores.length === 0 ? <EmptyState icon="account-group-outline" title="Nenhum cuidador vinculado" message="Gere um código temporário para adicionar uma pessoa de confiança." /> : cuidadores.map((cuidador) => (
          <Card key={cuidador.id} style={styles.cuidadorCard}>
            <View style={styles.avatar}>
              {cuidador.foto ? <Image accessible accessibilityLabel={`Foto de ${cuidador.nome}`} source={{ uri: cuidador.foto }} style={styles.avatarImage} /> : <Text accessibilityLabel={`Foto não cadastrada. Inicial ${cuidador.nome.charAt(0)}`} style={styles.avatarLabel}>{cuidador.nome.charAt(0)}</Text>}
            </View>
            <View style={styles.cuidadorInfo}>
              <Text style={styles.cuidadorNome}>{cuidador.nome}</Text>
              <Text style={styles.cuidadorDesde}>{formatPhone(cuidador.telefone) || 'Telefone não informado'} · {cuidador.vinculadoDesde}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Ligar para ${cuidador.nome}`} onPress={() => handleLigar(cuidador.nome, cuidador.telefone)} hitSlop={8} style={styles.callButton}>
              <MaterialCommunityIcons accessible={false} name="phone-outline" size={22} color={colors.coral} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${cuidador.nome}`} onPress={() => handleRemover(cuidador.id, cuidador.nome)} hitSlop={8} style={styles.removeButton}>
              <MaterialCommunityIcons accessible={false} name="close-circle-outline" size={22} color={colors.ember} />
            </Pressable>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  generateButton: { marginTop: 14, marginBottom: 16 },
  codeCard: { alignItems: 'center', marginBottom: 24, backgroundColor: colors.coralSoft },
  codeLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  code: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 7, color: colors.ink, marginVertical: 8 },
  codeHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, marginBottom: 12 },
  cuidadorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 20 },
  avatarLabel: { fontFamily: fonts.bodyBold, color: colors.sand, fontSize: 14 },
  cuidadorInfo: { flex: 1 },
  cuidadorNome: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  cuidadorDesde: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  callButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  removeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
