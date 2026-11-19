import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radii } from '../../theme/theme';
import BackHeader from '../../components/BackHeader';
import AppTextInput from '../../components/AppTextInput';
import AppButton from '../../components/AppButton';
import InlineNotice from '../../components/InlineNotice';
import Card from '../../components/Card';
import SegmentedToggle from '../../components/SegmentedToggle';
import { apiRequest, ApiError } from '../../services/api';
import WifiNetworkPicker from '../../components/WifiNetworkPicker';
import LifeguardWifi, { type BleDevice, type WifiNetwork } from '../../../modules/lifeguard-wifi';
import { useConnectionStore } from '../../store/connectionStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ParearDispositivo'>;

export default function ParearDispositivoScreen({ navigation, route }: Props) {
  const changingNetwork = route.params?.trocarRede === true;
  // BLE is the primary setup path: it does not make the phone switch to a
  // Wi-Fi network without internet while credentials are being sent.
  const [transport, setTransport] = useState<'wifi' | 'ble'>('ble');
  const [ssid, setSsid] = useState('');
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [bleDevices, setBleDevices] = useState<BleDevice[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningBle, setScanningBle] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [deviceCredential, setDeviceCredential] = useState('');
  const [credentialName, setCredentialName] = useState('');
  const [waitingForWifi, setWaitingForWifi] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const waitingForWifiRef = useRef(false);
  const checkingWifiConnectionRef = useRef(false);
  const setDeviceProvisioning = useConnectionStore((state) => state.setDeviceProvisioning);

  async function selectTransport(nextTransport: 'wifi' | 'ble') {
    if (loading || nextTransport === transport) return;
    setLoading(true);
    setError('');
    try {
      if (transport === 'wifi') await LifeguardWifi?.disconnectDeviceAsync();
      else await LifeguardWifi?.disconnectBleDeviceAsync();
      waitingForWifiRef.current = false;
      setWaitingForWifi(false);
      setDeviceConnected(false);
      setBleDevices([]);
      setTransport(nextTransport);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível encerrar a conexão atual.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setDeviceProvisioning(true);
    return () => {
      waitingForWifiRef.current = false;
      setDeviceProvisioning(false);
      void LifeguardWifi?.disconnectDeviceAsync();
      void LifeguardWifi?.disconnectBleDeviceAsync();
    };
  }, [setDeviceProvisioning]);

  async function requestWifiPermissions() {
    const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    if (typeof Platform.Version === 'number' && Platform.Version >= 33) permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (!permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error('Permita a localização e os dispositivos próximos para conectar ao LifeGuard.');
    }
  }

  async function requestBluetoothPermissions() {
    if (Platform.OS !== 'android' || typeof Platform.Version !== 'number' || Platform.Version < 31) return;
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (!permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error('Permita dispositivos próximos para buscar e conectar ao LifeGuard por Bluetooth.');
    }
  }

  async function confirmAccessPointConnection() {
    if (Platform.OS !== 'android' || !LifeguardWifi || checkingWifiConnectionRef.current) return;
    checkingWifiConnectionRef.current = true;
    setLoading(true);
    try {
      let connected = false;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        connected = await LifeguardWifi.checkDeviceWifiConnectionAsync();
        if (connected) break;
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      if (!connected) {
        setError('Não foi possível encontrar o LifeGuard. Conecte-se à rede Wi-Fi LIFEGUARD e permaneça conectado mesmo sem internet.');
        return;
      }
      waitingForWifiRef.current = false;
      setWaitingForWifi(false);
      setDeviceConnected(true);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar a conexão ao ponto de acesso.');
    } finally {
      checkingWifiConnectionRef.current = false;
      setLoading(false);
    }
  }

  async function connectToAccessPoint() {
    if (Platform.OS !== 'android' || !LifeguardWifi) return setError('A configuração do LifeGuard está disponível no aplicativo Android instalado.');
    setTransport('wifi');
    setLoading(true); setError('');
    try {
      await requestWifiPermissions();
      if (typeof Platform.Version === 'number' && Platform.Version >= 29) {
        await LifeguardWifi.connectToDeviceAsync('LIFEGUARD');
        waitingForWifiRef.current = false;
        setWaitingForWifi(false);
        setDeviceConnected(true);
        return;
      }
      waitingForWifiRef.current = true;
      setWaitingForWifi(true);
      await LifeguardWifi.openWifiSettingsAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível conectar ao LifeGuard.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && waitingForWifiRef.current) {
        void confirmAccessPointConnection();
      }
    });
    return () => subscription.remove();
  }, []);

  async function scanBleDevices() {
    if (Platform.OS !== 'android' || !LifeguardWifi) {
      setError('A conexão Bluetooth está disponível no aplicativo Android instalado.');
      return;
    }
    setScanningBle(true); setError(''); setBleDevices([]);
    try {
      await requestBluetoothPermissions();
      const foundDevices = await LifeguardWifi.scanBleDevicesAsync();
      setBleDevices(foundDevices);
      if (foundDevices.length === 0) setError('Nenhum LifeGuard encontrado. Ligue o dispositivo e tente novamente.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível buscar dispositivos Bluetooth.');
    } finally { setScanningBle(false); }
  }

  async function connectBleDevice(device: BleDevice) {
    if (Platform.OS !== 'android' || !LifeguardWifi) return;
    setLoading(true); setError('');
    try {
      await requestBluetoothPermissions();
      await LifeguardWifi.connectBleDeviceAsync(device.id);
      setDeviceConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível conectar ao LifeGuard por Bluetooth.');
    } finally { setLoading(false); }
  }

  async function sendConfiguration() {
    if (loading) return;
    if (!deviceConnected) return setError('Conecte-se primeiro ao LifeGuard.');
    // Native Expo modules reject an omitted argument before the Kotlin method
    // runs. Normalize all values here because a native TextInput/event can
    // still yield undefined at runtime despite the TypeScript state type.
    const networkSsid = typeof ssid === 'string' ? ssid.trim() : '';
    const networkPassword = typeof password === 'string' ? password : '';
    if (!networkSsid) return setError('Escolha a rede Wi-Fi.');
    setLoading(true); setError('');
    try {
      let credential = '';
      if (!changingNetwork) {
        const deviceName = 'LifeGuard';
        credential = credentialName === deviceName ? deviceCredential : '';
        if (!credential) {
          const result = await apiRequest<{ credencial: string | null }>('/dispositivos/provisionar', {
            method: 'POST',
            body: JSON.stringify({ nome: deviceName }),
          });
          credential = typeof result?.credencial === 'string' ? result.credencial : '';
          if (!credential) throw new Error('Não foi possível vincular o LifeGuard à sua conta. Tente novamente.');
          setDeviceCredential(credential);
          setCredentialName(deviceName);
        }
      }
      if (transport === 'wifi') {
        await LifeguardWifi!.provisionDeviceAsync(networkSsid, networkPassword, credential || '');
      } else {
        await LifeguardWifi!.provisionBleDeviceAsync(networkSsid, networkPassword, credential || '');
      }
      Alert.alert('Configuração enviada', 'O LifeGuard vai se conectar à rede escolhida. Aguarde até 90 segundos para o sinal aparecer.');
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível enviar a configuração ao LifeGuard.');
    } finally {
      setLoading(false);
    }
  }

  async function scanNetworks() {
    if (!deviceConnected || Platform.OS !== 'android' || !LifeguardWifi) return;
    setScanning(true); setError('');
    try {
      await requestWifiPermissions();
      setNetworks(await LifeguardWifi.scanNetworksAsync());
      setPickerVisible(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível buscar as redes Wi-Fi.'); }
    finally { setScanning(false); }
  }

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <BackHeader title={changingNetwork ? 'Alterar rede Wi-Fi' : 'Conectar dispositivo'} onBack={() => { if (!loading) navigation.goBack(); }} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.icon}><MaterialCommunityIcons name="wifi-cog" size={26} color={colors.white} /></View>
      <Text style={styles.title}>{changingNetwork ? 'Atualize o Wi-Fi do LifeGuard' : 'Conecte seu LifeGuard'}</Text>
      <Text style={styles.subtitle}>Escolha como o celular vai se conectar ao LifeGuard para enviar a configuração. Depois, ele usará a rede Wi-Fi escolhida para se conectar.</Text>
      {changingNetwork ? <InlineNotice message="Se a rede LIFEGUARD não aparecer, mantenha o botão BOOT do dispositivo pressionado por 3 segundos para reabrir a configuração e tente novamente." /> : null}
      <SegmentedToggle
        value={transport}
        onChange={(value) => void selectTransport(value)}
        disabled={loading || scanningBle}
        options={[
          { value: 'ble', label: 'Bluetooth (BLE)' },
          { value: 'wifi', label: 'Ponto de acesso' },
        ]}
      />
      {transport === 'wifi' ? (
        <Card><Text style={styles.section}>1. Conectar pelo ponto de acesso</Text><View style={styles.hint}><MaterialCommunityIcons name={deviceConnected ? 'check-circle' : 'access-point-network'} size={20} color={colors.inkSoft} /><Text style={styles.hintText}>{deviceConnected ? 'Conectado ao LifeGuard. Agora informe a rede Wi-Fi que ele deve usar.' : waitingForWifi ? 'Nas configurações do celular, conecte-se à rede LIFEGUARD, permaneça conectado sem internet e volte para cá.' : 'Conecte o celular à rede LIFEGUARD. Em Android 10 ou superior, aceite o pedido de conexão; em aparelhos antigos, selecione a rede nas configurações.'}</Text></View>
          <AppButton label={deviceConnected ? 'Conectado ao LifeGuard' : loading ? 'Conectando ao LifeGuard...' : typeof Platform.Version === 'number' && Platform.Version >= 29 ? 'Conectar ao LIFEGUARD' : 'Abrir configurações de Wi-Fi'} icon={deviceConnected ? 'check' : 'wifi'} variant="secondary" onPress={() => void connectToAccessPoint()} loading={loading} disabled={loading || deviceConnected} />
          {waitingForWifi && !deviceConnected ? <AppButton label="Já me conectei ao LIFEGUARD" icon="check" variant="text" onPress={() => void confirmAccessPointConnection()} loading={loading} disabled={loading} /> : null}
        </Card>
      ) : (
        <Card><Text style={styles.section}>1. Conectar por Bluetooth</Text><View style={styles.hint}><MaterialCommunityIcons name="bluetooth" size={20} color={colors.inkSoft} /><Text style={styles.hintText}>{deviceConnected ? 'Conectado ao LifeGuard por Bluetooth. Agora informe a rede Wi-Fi que ele deve usar.' : 'Ative o Bluetooth do celular e busque o LifeGuard próximo.'}</Text></View>
          <AppButton label={scanningBle ? 'Buscando LifeGuard...' : 'Buscar LifeGuard por BLE'} icon="bluetooth-settings" variant="secondary" onPress={() => void scanBleDevices()} loading={scanningBle} disabled={loading || deviceConnected} />
          {bleDevices.map((device) => <Pressable key={device.id} style={styles.bleDevice} onPress={() => void connectBleDevice(device)} disabled={loading || deviceConnected} accessibilityRole="button">
            <MaterialCommunityIcons name="bluetooth" size={20} color={colors.ink} /><Text style={styles.bleDeviceName}>{device.name}</Text><MaterialCommunityIcons name="chevron-right" size={22} color={colors.inkSoft} />
          </Pressable>)}
        </Card>
      )}
      <Card style={!deviceConnected ? styles.locked : undefined}><Text style={styles.section}>2. Rede do dispositivo</Text>{!deviceConnected ? <InlineNotice message="Conecte-se ao LifeGuard para liberar os dados da rede." /> : <><Text style={styles.label}>Nome da rede (SSID) <Text style={styles.required}>*</Text></Text><Pressable style={styles.selector} onPress={() => void scanNetworks()} accessibilityRole="button"><MaterialCommunityIcons name="wifi" size={22} color={colors.inkSoft} /><Text numberOfLines={1} style={[styles.selectorText, !ssid && styles.placeholder]}>{ssid || 'Escolha uma rede próxima'}</Text><MaterialCommunityIcons name={scanning ? 'progress-clock' : 'chevron-down'} size={22} color={colors.inkSoft} /></Pressable><Text style={styles.help}>As redes são ordenadas pela intensidade do sinal.</Text><AppTextInput label="Senha do Wi-Fi" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" maxLength={64} /><Text onPress={() => setShowPassword((value) => !value)} style={styles.show}>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</Text></>}</Card>
      {error ? <InlineNotice tone="warning" message={error} /> : null}<InlineNotice message="A senha do Wi-Fi é enviada somente ao LifeGuard." /><AppButton label={changingNetwork ? 'Enviar nova rede' : 'Configurar LifeGuard'} onPress={() => void sendConfiguration()} loading={loading} disabled={!deviceConnected} />
    </ScrollView></KeyboardAvoidingView>
    <WifiNetworkPicker visible={pickerVisible} networks={networks} selectedSsid={ssid} refreshing={scanning} onClose={() => setPickerVisible(false)} onRefresh={() => void scanNetworks()} onSelect={(value) => { setSsid(value); setPickerVisible(false); setError(''); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, flex: { flex: 1 }, container: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 }, icon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink }, subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary }, section: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, marginBottom: 12 }, bleDevice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, marginTop: 8, borderWidth: 1, borderColor: colors.inkMist, borderRadius: radii.md, backgroundColor: colors.white }, bleDeviceName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink }, hint: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radii.md, backgroundColor: colors.inkMist, marginBottom: 12 }, hintText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary }, locked: { opacity: 0.55 }, label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 7 }, required: { color: colors.ember }, selector: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.inkMist, borderRadius: radii.md, backgroundColor: colors.white }, selectorText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink }, placeholder: { color: colors.textSecondary }, help: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginVertical: 8 }, show: { alignSelf: 'flex-end', fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, paddingVertical: 8 },
});
