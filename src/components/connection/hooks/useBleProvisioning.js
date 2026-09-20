import { useState, useCallback, useRef } from 'react';

export const BLE_SERVICE_UUID = '0000ffff-0000-1000-8000-00805f9b34fb';
export const BLE_SSID_CHAR_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';
export const BLE_PASS_CHAR_UUID = '0000ff02-0000-1000-8000-00805f9b34fb';
export const BLE_STATUS_CHAR_UUID = '0000ff03-0000-1000-8000-00805f9b34fb';
export const BLE_WIFI_SCAN_CHAR_UUID = '0000ff04-0000-1000-8000-00805f9b34fb';
export const BLE_MAC_CHAR_UUID = '0000ff05-0000-1000-8000-00805f9b34fb';

export function useBleProvisioning() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [networks, setNetworks] = useState([]);
  const [mac, setMac] = useState(null);
  const connectionRef = useRef(null);

  const isSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  const connect = useCallback(async (serviceUuid = BLE_SERVICE_UUID) => {
    setStatus('requesting');
    setError(null);
    setNetworks([]);

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [serviceUuid],
      });

      setStatus('connecting');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(serviceUuid);

      connectionRef.current = { device, server, service };

      setStatus('connected');
      return true;
    } catch (err) {
      if (err.name === 'NotFoundError') {
        setError('Nenhum dispositivo encontrado ou seleção cancelada');
      } else {
        setError(err.message || 'Erro ao conectar via BLE');
      }
      setStatus('error');
      return false;
    }
  }, []);

  const scanNetworks = useCallback(async () => {
    if (!connectionRef.current) {
      setError('Conecte ao ESP32 antes de escanear as redes');
      setStatus('error');
      return;
    }

    try {
      setStatus('scanning');
      const { service } = connectionRef.current;
      const scanChar = await service.getCharacteristic(BLE_WIFI_SCAN_CHAR_UUID);
      const scanValue = await scanChar.readValue();
      const scanText = new TextDecoder().decode(scanValue);

      let parsed = [];
      try {
        parsed = JSON.parse(scanText);
        if (!Array.isArray(parsed)) parsed = parsed.networks || [];
      } catch {
        parsed = [];
      }
      setNetworks(parsed.filter((network) => network && typeof network.ssid === 'string'));
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Erro ao escanear redes via BLE');
      setStatus('error');
    }
  }, []);

  const connectAndScan = useCallback(async () => {
    if (await connect()) await scanNetworks();
  }, [connect, scanNetworks]);

  const provision = useCallback(async (ssid, password) => {
    if (!connectionRef.current) {
      setError('Conecte ao ESP32 primeiro');
      setStatus('error');
      return null;
    }

    const { service, device } = connectionRef.current;
    setError(null);

    try {
      setStatus('sending-ssid');
      const ssidChar = await service.getCharacteristic(BLE_SSID_CHAR_UUID);
      await ssidChar.writeValue(new TextEncoder().encode(ssid));

      setStatus('sending-password');
      const passChar = await service.getCharacteristic(BLE_PASS_CHAR_UUID);
      await passChar.writeValue(new TextEncoder().encode(password));

      setStatus('waiting');
      const statusChar = await service.getCharacteristic(BLE_STATUS_CHAR_UUID);
      const statusValue = await statusChar.readValue();
      const statusText = new TextDecoder().decode(statusValue);

      let deviceMac = null;
      try {
        const macChar = await service.getCharacteristic(BLE_MAC_CHAR_UUID);
        const macValue = await macChar.readValue();
        deviceMac = new TextDecoder().decode(macValue).trim();
        setMac(deviceMac);
      } catch {
        // MAC characteristic not available
      }

      if (statusText.includes('ok') || statusText.includes('success') || statusText.includes('connected')) {
        setStatus('success');
        return { mac: deviceMac };
      } else {
        setStatus('failed');
        setError(statusText || 'Provisionamento falhou');
        return null;
      }
    } catch (err) {
      setError(err.message || 'Erro no provisionamento BLE');
      setStatus('error');
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (connectionRef.current?.device?.gatt?.connected) {
      connectionRef.current.device.gatt.disconnect();
    }
    connectionRef.current = null;
    setStatus('idle');
    setError(null);
    setNetworks([]);
    setMac(null);
  }, []);

  return { status, error, networks, mac, isSupported, connect, scanNetworks, connectAndScan, provision, disconnect };
}