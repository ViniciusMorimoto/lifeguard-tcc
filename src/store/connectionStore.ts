import { create } from 'zustand';

export type ConnectionStatus = 'checking' | 'online' | 'offline';

type ConnectionState = {
  status: ConnectionStatus;
  message: string;
  deviceProvisioning: boolean;
  setChecking: () => void;
  setOnline: () => void;
  setOffline: (message?: string) => void;
  setDeviceProvisioning: (active: boolean) => void;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'checking',
  message: 'Verificando a conexão...',
  deviceProvisioning: false,
  setChecking: () => set((state) => state.status === 'offline'
    ? state
    : { status: 'checking', message: 'Verificando a conexão...' }),
  setOnline: () => set({ status: 'online', message: '' }),
  setOffline: (message = 'Sem conexão com a internet. Os últimos dados continuam disponíveis.') => set({ status: 'offline', message }),
  setDeviceProvisioning: (deviceProvisioning) => set({ deviceProvisioning }),
}));
