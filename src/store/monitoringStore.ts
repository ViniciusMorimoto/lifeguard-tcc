import { create } from 'zustand';
import type { StatusKey } from '../theme/theme';
import type { ElderProfile, Gender } from './authStore';

export type Elder = {
  id: string;
  vinculoId?: string;
  nome: string;
  status: StatusKey;
  batimento: number | null;
  temperatura: number | null;
  telefone: string;
  foto?: string | null;
  genero?: Gender | null;
  perfilIdoso?: ElderProfile | null;
  ultimaAtualizacao: string;
};

export type AlertStatus = 'novo' | 'visto' | 'resolvido';
export type MonitoringAlert = {
  id: string;
  idosoId: string;
  idosoNome: string;
  tipo: 'batimento' | 'temperatura';
  valor: number;
  horario: string;
  status: AlertStatus;
};

export type AlertLimits = {
  batimentoMin: number;
  batimentoMax: number;
  temperaturaMin: number;
  temperaturaMax: number;
  updatedBy: string;
  updatedAt: string;
};

export type Caregiver = { id: string; usuarioId: string; nome: string; telefone: string; foto?: string | null; vinculadoDesde: string };

type MonitoringState = {
  elders: Elder[];
  caregivers: Caregiver[];
  alerts: MonitoringAlert[];
  limitsByElder: Record<string, AlertLimits>;
  setElders: (elders: Elder[]) => void;
  upsertElder: (elder: Elder) => void;
  removeElder: (elderId: string) => void;
  setCaregivers: (caregivers: Caregiver[]) => void;
  setAlerts: (alerts: MonitoringAlert[]) => void;
  setLimits: (elderId: string, limits: AlertLimits) => void;
  reset: () => void;
  removeCaregiver: (id: string) => void;
  updateAlertStatus: (id: string, status: AlertStatus) => void;
};

export const useMonitoringStore = create<MonitoringState>((set) => ({
  elders: [],
  caregivers: [],
  alerts: [],
  limitsByElder: {},
  setElders: (elders) => set({ elders }),
  upsertElder: (elder) => set((state) => {
    const current = state.elders.find((item) => item.id === elder.id);
    return { elders: [...state.elders.filter((item) => item.id !== elder.id), { ...current, ...elder, vinculoId: elder.vinculoId ?? current?.vinculoId }] };
  }),
  removeElder: (elderId) => set((state) => ({ elders: state.elders.filter((elder) => elder.id !== elderId) })),
  setCaregivers: (caregivers) => set({ caregivers }),
  setAlerts: (alerts) => set({ alerts }),
  setLimits: (elderId, limits) => set((state) => ({ limitsByElder: { ...state.limitsByElder, [elderId]: limits } })),
  reset: () => set({ elders: [], caregivers: [], alerts: [], limitsByElder: {} }),
  removeCaregiver: (id) => set((state) => ({ caregivers: state.caregivers.filter((caregiver) => caregiver.id !== id) })),
  updateAlertStatus: (id, status) => set((state) => ({ alerts: state.alerts.map((alert) => alert.id === id ? { ...alert, status } : alert) })),
}));
