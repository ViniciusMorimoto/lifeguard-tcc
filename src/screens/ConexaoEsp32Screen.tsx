import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { decode, encode } from 'base-64';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import BackHeader from '../components/BackHeader';
import Card from '../components/Card';
import AppButton from '../components/AppButton';
import { colors, fonts, radii } from '../theme/theme';
import { useDeviceStore } from '../store/deviceStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ConexaoEsp32'>;
type Network = { ssid: string; rssi?: number };

const AP_IP = '192.168.4.1';
const SERVICE_UUID = '0000ffff-0000-1000-8000-00805f9b34fb';
const SSID_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';
const PASSWORD_UUID = '0000ff02-0000-1000-8000-00805f9b34fb';
const STATUS_UUID = '0000ff03-0000-1000-8000-00805f9b34fb';
const SCAN_UUID = '0000ff04-0000-1000-8000-00805f9b34fb';
const MAC_UUID = '0000ff05-0000-1000-8000-00805f9b34fb';

export default function ConexaoEsp32Screen({ navigation }: Props) {
  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const [mode, setMode] = useState<'ble' | 'ap'>('ble');
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedSsid, setSelectedSsid] = useState('');
  const [password, setPassword] = useState('');
  const [bleStatus, setBleStatus] = useState('idle');
  const [bleDevices, setBleDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      managerRef.current = new BleManager();
    } catch {
      setError('Bluetooth BLE indisponível neste aplicativo. Use um development build para adicionar por Bluetooth.');
    }

    return () => {
      managerRef.current?.stopDeviceScan();
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []);

  function showError(message: string) {
    setError(message);
    setBusy(false);
  }

  function scanBleDevices() {
    const manager = managerRef.current;
    if (!manager) {
      setError('Bluetooth BLE indisponível neste aplicativo. Use um development build para adicionar por Bluetooth.');
      return;
    }
    setError('');
    setBleDevices([]);
    setBleStatus('scanning');
    manager.startDeviceScan([SERVICE_UUID], null, (scanError, device) => {
      if (scanError) {
        manager.stopDeviceScan();
        setBleStatus('error');
        showError(scanError.message);
        return;
      }
      if (device) {
        setBleDevices((current) => current.some((item) => item.id === device.id) ? current : [...current, device]);
      }
    });
    setTimeout(() => {
      manager.stopDeviceScan();
      setBleStatus('idle');
    }, 10000);
  }

  async function connectBleDevice(device: Device) {
    const manager = managerRef.current;
    if (!manager) {
      setError('Bluetooth BLE indisponível neste aplicativo. Use um development build para adicionar por Bluetooth.');
      return;
    }
    setBusy(true);
    setError('');
    setBleStatus('connecting');
    try {
      manager.stopDeviceScan();
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      deviceRef.current = connected;
      setBleStatus('connected');
      const scanCharacteristic = await connected.readCharacteristicForService(SERVICE_UUID, SCAN_UUID);
      const parsed = JSON.parse(decode(scanCharacteristic.value || '[]'));
      setNetworks(Array.isArray(parsed) ? parsed : parsed.networks || []);
    } catch (bleError) {
      showError(bleError instanceof Error ? bleError.message : 'Não foi possível conectar ao ESP32 via Bluetooth.');
      setBleStatus('error');
    } finally {
      setBusy(false);
    }
  }

  async function provisionBle() {
    const device = deviceRef.current;
    if (!device || !selectedSsid) return;
    setBusy(true);
    setError('');
    try {
      await device.writeCharacteristicWithResponseForService(SERVICE_UUID, SSID_UUID, encode(selectedSsid));
      await device.writeCharacteristicWithResponseForService(SERVICE_UUID, PASSWORD_UUID, encode(password));
      const status = await device.readCharacteristicForService(SERVICE_UUID, STATUS_UUID);
      const statusText = decode(status.value || '').toLowerCase();
      if (statusText && !['ok', 'success', 'connected'].some((value) => statusText.includes(value))) throw new Error(statusText);
      const macCharacteristic = await device.readCharacteristicForService(SERVICE_UUID, MAC_UUID).catch(() => null);
      const mac = macCharacteristic?.value ? decode(macCharacteristic.value).trim() : device.id;
      useDeviceStore.getState().setMac(mac);
      Alert.alert('Dispositivo conectado', 'As credenciais foram enviadas via Bluetooth.', [{ text: 'Continuar', onPress: () => navigation.goBack() }]);
    } catch (bleError) {
      showError(bleError instanceof Error ? bleError.message : 'Erro ao enviar as credenciais via Bluetooth.');
    } finally {
      setBusy(false);
    }
  }

  async function requestAp(path: string, options?: RequestInit) {
    const response = await fetch(`http://${AP_IP}${path}`, options);
    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
    return response.json().catch(() => ({}));
  }

  async function scanApNetworks() {
    setBusy(true);
    setError('');
    try {
      const result = await requestAp('/scan');
      setNetworks(Array.isArray(result.networks) ? result.networks.filter((network: Network) => network?.ssid) : []);
    } catch {
      showError('Não foi possível acessar o ESP32. Conecte o celular à rede AP do dispositivo e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function provisionAp() {
    if (!selectedSsid) return;
    setBusy(true);
    setError('');
    try {
      const result = await requestAp('/provision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ssid: selectedSsid, password }) });
      if (result.status === 'fail' || result.error) throw new Error(result.error || 'O ESP32 não conseguiu conectar ao Wi-Fi.');
      if (result.mac) useDeviceStore.getState().setMac(result.mac);
      Alert.alert('Dispositivo conectado', 'As credenciais foram enviadas com sucesso.', [{ text: 'Continuar', onPress: () => navigation.goBack() }]);
    } catch (apError) {
      showError(apError instanceof Error ? apError.message : 'Erro ao enviar as credenciais.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.safe}>
      <BackHeader title="Adicionar dispositivo" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.tabs}>
          <Pressable onPress={() => setMode('ble')} style={[styles.tab, mode === 'ble' && styles.activeTab]}><Text style={[styles.tabText, mode === 'ble' && styles.activeTabText]}>Bluetooth</Text></Pressable>
          <Pressable onPress={() => setMode('ap')} style={[styles.tab, mode === 'ap' && styles.activeTab]}><Text style={[styles.tabText, mode === 'ap' && styles.activeTabText]}>Ponto de acesso</Text></Pressable>
        </View>

        {mode === 'ble' && <Card style={styles.card}>
          <Text style={styles.title}>Adicionar via Bluetooth</Text>
          <Text style={styles.description}>Ligue o ESP32 e mantenha-o próximo ao celular.</Text>
          <AppButton label={bleStatus === 'scanning' ? 'Procurando...' : 'Procurar dispositivos'} onPress={scanBleDevices} style={styles.button} />
          {bleDevices.map((device) => <Pressable key={device.id} onPress={() => connectBleDevice(device)} style={styles.network}><Text style={styles.networkName}>{device.name || device.localName || 'ESP32 sem nome'}</Text><Text style={styles.rssi}>Conectar</Text></Pressable>)}
          {bleStatus === 'scanning' && <ActivityIndicator color={colors.coral} style={styles.loader} />}
          {bleStatus === 'connected' && <Text style={styles.connected}>Bluetooth conectado</Text>}
        </Card>}

        {mode === 'ap' && <Card style={styles.card}><Text style={styles.title}>Adicionar via ponto de acesso</Text><Text style={styles.description}>Conecte o celular à rede ESP32-SETUP antes de buscar as redes.</Text><AppButton label={busy ? 'Acessando dispositivo...' : 'Buscar redes'} onPress={scanApNetworks} style={styles.button} /></Card>}

        {(mode === 'ap' || bleStatus === 'connected') && <Card style={styles.card}>
          <Text style={styles.label}>Redes Wi-Fi disponíveis</Text>
          {networks.map((network, index) => <Pressable key={`${network.ssid}-${network.rssi ?? 'unknown'}-${index}`} onPress={() => setSelectedSsid(network.ssid)} style={[styles.network, selectedSsid === network.ssid && styles.selectedNetwork]}><Text style={styles.networkName}>{network.ssid}</Text><Text style={styles.rssi}>{network.rssi != null ? `${network.rssi} dBm` : ''}</Text></Pressable>)}
          {networks.length === 0 && <Text style={styles.empty}>Nenhuma rede carregada ainda.</Text>}
          <Text style={styles.label}>Senha Wi-Fi</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="Digite a senha" secureTextEntry style={styles.input} />
          <AppButton label="Enviar credenciais" onPress={mode === 'ble' ? provisionBle : provisionAp} style={styles.button} />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </Card>}
        {!!error && mode === 'ble' && bleStatus !== 'connected' && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { padding: 20, paddingBottom: 40 },
  tabs: { flexDirection: 'row', backgroundColor: colors.cardBg, borderRadius: radii.md, padding: 4, marginBottom: 16 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderRadius: radii.sm },
  activeTab: { backgroundColor: colors.ink },
  tabText: { fontFamily: fonts.bodyBold, color: colors.textSecondary, textAlign: 'center' },
  activeTabText: { color: colors.sand },
  card: { marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginBottom: 8 },
  description: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginBottom: 12 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 8 },
  button: { marginVertical: 8 },
  loader: { marginVertical: 8 },
  connected: { fontFamily: fonts.bodyBold, color: colors.moss, marginTop: 8 },
  network: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, marginTop: 8 },
  selectedNetwork: { borderColor: colors.coral, backgroundColor: colors.amberBg },
  networkName: { fontFamily: fonts.bodyBold, color: colors.ink, flex: 1 },
  rssi: { fontFamily: fonts.body, color: colors.textSecondary },
  empty: { fontFamily: fonts.body, color: colors.textSecondary, paddingVertical: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 14, fontFamily: fonts.body, color: colors.ink, marginBottom: 14, backgroundColor: colors.cardBg },
  error: { fontFamily: fonts.body, color: colors.ember, marginTop: 8 },
});
