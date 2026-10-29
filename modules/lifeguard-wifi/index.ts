import { requireOptionalNativeModule } from 'expo-modules-core';

export type WifiNetwork = {
  ssid: string;
  level: number;
  frequency: number;
};

type LifeguardWifiModule = {
  scanNetworksAsync(): Promise<WifiNetwork[]>;
  connectToDeviceAsync(ssid: string): Promise<void>;
  provisionDeviceAsync(ssid: string, password: string, credential: string): Promise<void>;
  disconnectDeviceAsync(): Promise<void>;
};

export default requireOptionalNativeModule<LifeguardWifiModule>('LifeguardWifi');
