import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme/theme';
import type { WifiNetwork } from '../../modules/lifeguard-wifi';
import AppButton from './AppButton';

type Props = {
  visible: boolean;
  networks: WifiNetwork[];
  selectedSsid: string;
  onClose: () => void;
  onRefresh: () => void;
  onSelect: (ssid: string) => void;
  refreshing?: boolean;
};

function signalLabel(level: number) {
  if (level >= -55) return 'Sinal excelente';
  if (level >= -67) return 'Sinal bom';
  if (level >= -80) return 'Sinal fraco';
  return 'Sinal muito fraco';
}

function signalIcon(level: number): 'wifi-strength-1' | 'wifi-strength-2' | 'wifi-strength-3' | 'wifi-strength-4' {
  if (level >= -55) return 'wifi-strength-4';
  if (level >= -67) return 'wifi-strength-3';
  if (level >= -80) return 'wifi-strength-2';
  return 'wifi-strength-1';
}

export default function WifiNetworkPicker({ visible, networks, selectedSsid, onClose, onRefresh, onSelect, refreshing = false }: Props) {
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Redes Wi-Fi próximas</Text>
          <Text style={styles.subtitle}>Ordenadas da mais forte para a mais fraca</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar lista de redes" style={styles.close}>
          <MaterialCommunityIcons name="close" size={24} color={colors.ink} />
        </Pressable>
      </View>

      <FlatList
        data={networks}
        keyExtractor={(network) => network.ssid}
        contentContainerStyle={networks.length ? styles.list : styles.empty}
        renderItem={({ item }) => {
          const selected = item.ssid === selectedSsid;
          return <Pressable
            style={[styles.network, selected && styles.networkSelected]}
            onPress={() => onSelect(item.ssid)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${item.ssid}, ${signalLabel(item.level)}`}
          >
            <MaterialCommunityIcons name={signalIcon(item.level)} size={26} color={selected ? colors.white : colors.inkSoft} />
            <View style={styles.networkInfo}>
              <Text numberOfLines={1} style={[styles.ssid, selected && styles.ssidSelected]}>{item.ssid}</Text>
              <Text style={[styles.signal, selected && styles.signalSelected]}>{signalLabel(item.level)} · {item.level} dBm</Text>
            </View>
            {selected ? <MaterialCommunityIcons name="check" size={22} color={colors.white} /> : null}
          </Pressable>;
        }}
        ListEmptyComponent={<View style={styles.emptyContent}>
          <MaterialCommunityIcons name="wifi-off" size={34} color={colors.inkSoft} />
          <Text style={styles.emptyTitle}>Nenhuma rede encontrada</Text>
          <Text style={styles.emptyText}>Ligue o Wi-Fi e a localização do celular e tente buscar novamente.</Text>
        </View>}
        ListFooterComponent={<AppButton label="Buscar redes novamente" icon="refresh" variant="secondary" onPress={onRefresh} loading={refreshing} style={styles.refresh} />}
      />
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.inkMist },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  close: { padding: 8, marginRight: -8 },
  list: { padding: 16, gap: 8 },
  network: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.inkMist, backgroundColor: colors.white },
  networkSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  networkInfo: { flex: 1, minWidth: 0 },
  ssid: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  ssidSelected: { color: colors.white },
  signal: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  signalSelected: { color: colors.sand },
  empty: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  emptyContent: { alignItems: 'center', gap: 8, paddingBottom: 28 },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, marginTop: 4 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center', color: colors.textSecondary },
  refresh: { marginTop: 16 },
});
