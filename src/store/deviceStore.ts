import { create } from 'zustand';

type DeviceState = {
  mac: string | null;
  setMac: (mac: string | null) => void;
  clear: () => void;
};

export const useDeviceStore = create<DeviceState>((set) => ({
  mac: null,
  setMac: (mac) => set({ mac: mac?.trim() || null }),
  clear: () => set({ mac: null }),
}));
