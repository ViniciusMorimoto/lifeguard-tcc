import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radii } from '../../theme/theme';
import BackHeader from '../../components/BackHeader';
import Card from '../../components/Card';
import AppButton from '../../components/AppButton';
import { useDeviceStore } from '../../store/deviceStore';

type Props = NativeStackScreenProps<RootStackParamList, 'MeuDispositivo'>;

// TODO: substituir por dados reais (GET /dispositivos/:idosoId)
const dispositivoMock = {
  conectado: true,
  nome: 'ESP32 - Pulseira',
  codigoHardware: 'A1B2C3D4E5F6',
  ultimaSincronizacao: 'há 40 segundos',
};

export default function MeuDispositivoScreen({ navigation }: Props) {
  const [dispositivo, setDispositivo] = useState<typeof dispositivoMock | null>(dispositivoMock);
  const clearDevice = useDeviceStore((state) => state.clear);
  const conectado = dispositivo?.conectado ?? false;

  function handleParear() {
    navigation.navigate('ConexaoEsp32');
  }

  function handleExcluir() {
    Alert.alert('Excluir dispositivo', 'O dispositivo será removido deste perfil. Deseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { clearDevice(); setDispositivo(null); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Meu dispositivo" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.container}>
        {dispositivo ? <>
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: conectado ? colors.moss : colors.ember }]} />
            <Text style={styles.statusLabel}>{conectado ? 'Conectado' : 'Desconectado'}</Text>
          </View>
          <MaterialCommunityIcons
            name={conectado ? 'wifi' : 'wifi-off'}
            size={22}
            color={conectado ? colors.moss : colors.ember}
          />
        </Card>

        <Card style={styles.infoCard}>
          <InfoRow label="Nome" value={dispositivo.nome} />
          <InfoRow label="Código do hardware" value={dispositivo.codigoHardware} />
          <InfoRow label="Última sincronização" value={dispositivo.ultimaSincronizacao} last />
        </Card>

        <AppButton label="Parear novo dispositivo" onPress={handleParear} style={{ marginTop: 8 }} />
        <Pressable onPress={handleExcluir} style={styles.deleteButton}><Text style={styles.deleteLabel}>Excluir dispositivo</Text></Pressable>
        </> : <Card style={styles.emptyCard}><Text style={styles.emptyTitle}>Nenhum dispositivo conectado</Text><Text style={styles.emptyText}>Adicione um ESP32 por Bluetooth ou ponto de acesso.</Text><AppButton label="Adicionar dispositivo" onPress={handleParear} style={{ marginTop: 16 }} /></Card>}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { paddingHorizontal: 20, paddingBottom: 40 },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  infoCard: { marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  infoValue: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  deleteButton: { alignItems: 'center', padding: 16, marginTop: 8 },
  deleteLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ember },
  emptyCard: { marginTop: 8 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
});