import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { apiRequest, ApiError } from '../../services/api';
import WifiNetworkPicker from '../../components/WifiNetworkPicker';
import LifeguardWifi, { type WifiNetwork } from '../../../modules/lifeguard-wifi';

type Props = NativeStackScreenProps<RootStackParamList, 'ParearDispositivo'>;

export default function ParearDispositivoScreen({ navigation, route }: Props) {
  const changingNetwork = route.params?.trocarRede === true;
  const [name, setName] = useState('Meu ESP32');
  const [ssid, setSsid] = useState('');
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { void LifeguardWifi?.disconnectDeviceAsync(); }, []);

  async function requestWifiPermissions() {
    const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    if (typeof Platform.Version === 'number' && Platform.Version >= 33) permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (!permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error('Permita a localização e os dispositivos próximos para conectar ao ESP32.');
    }
  }

  async function connectToDevice() {
    if (Platform.OS !== 'android' || !LifeguardWifi) return setError('A conexão automática está disponível no aplicativo Android instalado.');
    setLoading(true); setError('');
    try {
      await requestWifiPermissions();
      await LifeguardWifi.connectToDeviceAsync('LifeGuard-ESP32');
      setDeviceConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível conectar ao ESP32.');
    } finally { setLoading(false); }
  }

  async function sendConfiguration() {
    if (loading) return;
    if (!deviceConnected) return setError('Conecte-se primeiro ao ESP32.');
    if (!changingNetwork && name.trim().length < 2) return setError('Informe um nome com pelo menos dois caracteres.');
    if (!ssid.trim()) return setError('Escolha a rede Wi-Fi.');
    setLoading(true); setError('');
    try {
      let credential = '';
      if (!changingNetwork) {
        const result = await apiRequest<{ credencial: string | null }>('/dispositivos/provisionar', { method: 'POST', body: JSON.stringify({ nome: name.trim() }) });
        credential = result.credencial ?? '';
        if (!credential) throw new Error('O servidor não gerou a credencial do dispositivo.');
      }
      await LifeguardWifi!.provisionDeviceAsync(ssid.trim(), password, credential);
      Alert.alert('Configuração enviada', 'O ESP32 vai se conectar à rede escolhida. Aguarde até 90 segundos para o sinal aparecer.');
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível enviar a configuração ao ESP32.');
    } finally {
      await LifeguardWifi?.disconnectDeviceAsync().catch(() => undefined);
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
      <Text style={styles.title}>{changingNetwork ? 'Atualize o Wi-Fi do seu ESP32' : 'Conecte seu dispositivo'}</Text>
      <Text style={styles.subtitle}>Primeiro conecte o aplicativo ao ESP32. Só então a rede e a senha serão liberadas para envio local.</Text>
      <Card><Text style={styles.section}>1. Conectar ao ESP32</Text><View style={styles.hint}><MaterialCommunityIcons name={deviceConnected ? 'check-circle' : 'access-point-network'} size={20} color={colors.inkSoft} /><Text style={styles.hintText}>{deviceConnected ? 'Conectado ao ESP32. Agora informe a rede que ele deve usar.' : 'Ligue o ESP32 e toque abaixo. Ele oferece temporariamente a rede aberta LifeGuard-ESP32; confirme a conexão do Android.'}</Text></View><AppButton label={deviceConnected ? 'ESP32 conectado' : 'Conectar ao ESP32'} icon={deviceConnected ? 'check' : 'wifi'} variant="secondary" onPress={() => void connectToDevice()} disabled={loading || deviceConnected} /></Card>
      <Card style={!deviceConnected ? styles.locked : undefined}><Text style={styles.section}>2. Rede do dispositivo</Text>{!deviceConnected ? <InlineNotice message="Conecte-se ao ESP32 para liberar os dados da rede." /> : <><Text style={styles.label}>Nome da rede (SSID) <Text style={styles.required}>*</Text></Text><Pressable style={styles.selector} onPress={() => void scanNetworks()} accessibilityRole="button"><MaterialCommunityIcons name="wifi" size={22} color={colors.inkSoft} /><Text numberOfLines={1} style={[styles.selectorText, !ssid && styles.placeholder]}>{ssid || 'Escolha uma rede próxima'}</Text><MaterialCommunityIcons name={scanning ? 'progress-clock' : 'chevron-down'} size={22} color={colors.inkSoft} /></Pressable><Text style={styles.help}>As redes são ordenadas pela intensidade do sinal.</Text><AppTextInput label="Senha do Wi-Fi" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" maxLength={64} /><Text onPress={() => setShowPassword((value) => !value)} style={styles.show}>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</Text></>}</Card>
      {!changingNetwork ? <Card style={!deviceConnected ? styles.locked : undefined}><Text style={styles.section}>3. Identificação</Text><AppTextInput label="Nome do dispositivo" value={name} onChangeText={setName} maxLength={60} required editable={deviceConnected} /></Card> : null}
      {error ? <InlineNotice tone="warning" message={error} /> : null}<InlineNotice message="A senha do Wi-Fi e a credencial são enviadas somente pela conexão local com o ESP32; o servidor não recebe a senha da rede." /><AppButton label={changingNetwork ? 'Enviar nova rede' : 'Configurar ESP32'} onPress={() => void sendConfiguration()} loading={loading} disabled={!deviceConnected} />
    </ScrollView></KeyboardAvoidingView>
    <WifiNetworkPicker visible={pickerVisible} networks={networks} selectedSsid={ssid} refreshing={scanning} onClose={() => setPickerVisible(false)} onRefresh={() => void scanNetworks()} onSelect={(value) => { setSsid(value); setPickerVisible(false); setError(''); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, flex: { flex: 1 }, container: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 }, icon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink }, subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary }, section: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, marginBottom: 12 }, hint: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radii.md, backgroundColor: colors.inkMist, marginBottom: 12 }, hintText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary }, locked: { opacity: 0.55 }, label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 7 }, required: { color: colors.ember }, selector: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.inkMist, borderRadius: radii.md, backgroundColor: colors.white }, selectorText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink }, placeholder: { color: colors.textSecondary }, help: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginVertical: 8 }, show: { alignSelf: 'flex-end', fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, paddingVertical: 8 },
});
