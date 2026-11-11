import { apiRequest, ApiError, formatDateTime } from './api';
import type { AlertLimits, Caregiver, Elder, MonitoringAlert } from '../store/monitoringStore';
import type { ElderProfile, Gender } from '../store/authStore';
import { useAuthStore } from '../store/authStore';
import { readSecureCache, writeSecureCache } from './secureCache';

type ApiReading = {
  id: string;
  batimento: number | null;
  temperatura: number | null;
  batimentoMinimo?: number | null;
  batimentoMaximo?: number | null;
  temperaturaMinima?: number | null;
  temperaturaMaxima?: number | null;
  horario: string;
  qualidadeSinal: string;
  contatoDetectado: boolean;
  valida: boolean;
  motivoInvalido: string | null;
  origem?: string;
};

type ApiElder = {
  id: string;
  vinculoId?: string;
  nome: string;
  telefone: string | null;
  foto?: string | null;
  genero?: Gender | null;
  perfilIdoso?: ElderProfile | null;
  status: Elder['status'];
  ultimaLeitura: ApiReading | null;
  limites?: ApiLimits | null;
};

type ApiLimits = {
  batimentoMin: number;
  batimentoMax: number;
  temperaturaMin: number;
  temperaturaMax: number;
  atualizadoEm: string;
  definidoPor: string | null;
};

export type Reading = ApiReading;

type CacheMetadata = {
  fromCache: boolean;
  savedAt: string | null;
};

export type PatientChange = {
  id: string;
  categoria: 'perfil' | 'limites';
  campos: string[];
  alteradoEm: string;
  alteradoPor: { id: string; nome: string; tipo: 'paciente' | 'cuidador' } | null;
};

export function mapElder(elder: ApiElder): Elder {
  return {
    id: elder.id,
    vinculoId: elder.vinculoId,
    nome: elder.nome,
    telefone: elder.telefone ?? '',
    foto: elder.foto,
    genero: elder.genero,
    perfilIdoso: elder.perfilIdoso,
    status: elder.status,
    // Mantém a última medida válida visível mesmo quando o sinal atual caiu.
    batimento: elder.ultimaLeitura?.valida ? elder.ultimaLeitura.batimento : null,
    temperatura: elder.ultimaLeitura?.valida ? elder.ultimaLeitura.temperatura : null,
    ultimaAtualizacao: elder.ultimaLeitura ? formatDateTime(elder.ultimaLeitura.horario) : 'nenhum registro',
  };
}

export function mapLimits(limits: ApiLimits): AlertLimits {
  return {
    batimentoMin: limits.batimentoMin,
    batimentoMax: limits.batimentoMax,
    temperaturaMin: limits.temperaturaMin,
    temperaturaMax: limits.temperaturaMax,
    updatedBy: limits.definidoPor ?? 'sistema',
    updatedAt: formatDateTime(limits.atualizadoEm),
  };
}

export async function fetchCaregiverDashboard(): Promise<{ elders: Elder[]; alerts: MonitoringAlert[]; cache: CacheMetadata }> {
  const auth = useAuthStore.getState();
  const ownerId = auth.rememberSession ? auth.user?.id : undefined;
  const scope = 'caregiver-dashboard';
  try {
    const [eldersResponse, alertsResponse] = await Promise.all([
      apiRequest<{ idosos: ApiElder[] }>('/idosos'),
      apiRequest<{ alertas: Array<Omit<MonitoringAlert, 'horario'> & { horario: string; valor: number | null }> }>('/alertas'),
    ]);
    const dashboard = {
      elders: eldersResponse.idosos.map(mapElder),
      alerts: alertsResponse.alertas
        .filter((alert): alert is typeof alert & { valor: number; tipo: 'batimento' | 'temperatura' } =>
          alert.valor !== null && (alert.tipo === 'batimento' || alert.tipo === 'temperatura'))
        .map((alert) => ({ ...alert, horario: formatDateTime(alert.horario) })),
    };
    if (ownerId) {
      const cacheable = {
        elders: dashboard.elders.map((elder) => ({ ...elder, foto: null })),
        alerts: dashboard.alerts.slice(0, 50),
      };
      void writeSecureCache(ownerId, scope, cacheable).catch(() => undefined);
    }
    return { ...dashboard, cache: { fromCache: false, savedAt: null } };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status || !ownerId) throw error;
    const cached = await readSecureCache<{ elders: Elder[]; alerts: MonitoringAlert[] }>(ownerId, scope);
    if (!cached) throw error;
    return { ...cached.data, cache: { fromCache: true, savedAt: cached.savedAt } };
  }
}

export async function fetchElder(elderId: string): Promise<{ elder: Elder; limits: AlertLimits | null; cache: CacheMetadata }> {
  const auth = useAuthStore.getState();
  const ownerId = auth.rememberSession ? auth.user?.id : undefined;
  const scope = `patient-${elderId}`;
  try {
    const response = await apiRequest<{ idoso: ApiElder }>(`/idosos/${elderId}`);
    const result = {
      elder: mapElder(response.idoso),
      limits: response.idoso.limites ? mapLimits(response.idoso.limites) : null,
    };
    if (ownerId) void writeSecureCache(ownerId, scope, { ...result, elder: { ...result.elder, foto: null } }).catch(() => undefined);
    return { ...result, cache: { fromCache: false, savedAt: null } };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status || !ownerId) throw error;
    const cached = await readSecureCache<{ elder: Elder; limits: AlertLimits | null }>(ownerId, scope);
    if (!cached) throw error;
    return {
      ...cached.data,
      cache: { fromCache: true, savedAt: cached.savedAt },
    };
  }
}

export async function fetchLimits(elderId: string) {
  const response = await apiRequest<{ limites: ApiLimits }>(`/idosos/${elderId}/limites`);
  return mapLimits(response.limites);
}

export async function saveLimits(elderId: string, limits: Omit<AlertLimits, 'updatedBy' | 'updatedAt'>) {
  const response = await apiRequest<{ limites: ApiLimits }>(`/idosos/${elderId}/limites`, {
    method: 'PUT',
    body: JSON.stringify(limits),
  });
  return mapLimits(response.limites);
}

export async function fetchReadings(elderId: string, limit = 100, resolucao: '10s' | '1h' = '1h') {
  const response = await apiRequest<{ leituras: Reading[] }>(`/idosos/${elderId}/leituras?limite=${limit}&resolucao=${resolucao}`);
  return response.leituras;
}

export async function fetchPatientChanges(elderId: string) {
  const response = await apiRequest<{ alteracoes: PatientChange[] }>(`/idosos/${elderId}/alteracoes`);
  return response.alteracoes;
}

export async function fetchCaregivers(): Promise<Caregiver[]> {
  const response = await apiRequest<{ vinculos: Array<{ id: string; usuario: { id: string; nome: string; telefone?: string | null; foto?: string | null }; vinculadoEm: string }> }>('/vinculos');
  return response.vinculos.map((link) => ({
    id: link.id,
    usuarioId: link.usuario.id,
    nome: link.usuario.nome,
    telefone: link.usuario.telefone ?? '',
    foto: link.usuario.foto,
    vinculadoDesde: `desde ${new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(link.vinculadoEm))}`,
  }));
}
