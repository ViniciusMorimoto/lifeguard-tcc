import { requireOptionalNativeModule } from 'expo-modules-core';

export type WifiNetwork = {
  ssid: string;
  level: number;
  frequency: number;
};

export type BleDevice = {
  id: string;
  name: string;
};

type LifeguardWifiModule = {
  scanNetworksAsync(): Promise<WifiNetwork[]>;
  connectToDeviceAsync(ssid: string): Promise<void>;
  openWifiSettingsAsync(): Promise<void>;
  checkDeviceWifiConnectionAsync(): Promise<boolean>;
  provisionDeviceAsync(ssid: string, password: string, credential: string): Promise<void>;
  scanBleDevicesAsync(): Promise<BleDevice[]>;
  connectBleDeviceAsync(id: string): Promise<void>;
  provisionBleDeviceAsync(ssid: string, password: string, credential: string): Promise<void>;
  disconnectDeviceAsync(): Promise<void>;
  disconnectBleDeviceAsync(): Promise<void>;
};

export default requireOptionalNativeModule<LifeguardWifiModule>('LifeguardWifi');
