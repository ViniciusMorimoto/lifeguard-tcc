import { useConnectionStore } from '../store/connectionStore';

const productionApiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'https://152-67-44-170.sslip.io/api').trim().replace(/\/+$/, '');
let apiUrl = productionApiUrl;

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

function markServerOnline() {
  useConnectionStore.getState().setOnline();
}

function markServerOffline(message: string) {
  useConnectionStore.getState().setOffline(message);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setApiToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getApiUrl() {
  return apiUrl;
}

export function setApiUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!__DEV__ && normalized !== productionApiUrl) {
    throw new Error('A alteração do servidor só está disponível em desenvolvimento.');
  }
  if (!__DEV__ && !normalized.startsWith('https://')) {
    throw new Error('A API de produção exige HTTPS.');
  }
  apiUrl = normalized;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    markServerOnline();
    if (!response.ok) {
      if (response.status === 401 && accessToken) {
        accessToken = null;
        unauthorizedHandler?.();
      }
      throw new ApiError(body?.erro ?? 'Não foi possível concluir a solicitação.', response.status, body?.codigo);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      const message = 'A conexão demorou demais. Confira sua internet e tente novamente.';
      markServerOffline(message);
      throw new ApiError(message, undefined, 'CONNECTION_TIMEOUT');
    }
    const message = 'Não foi possível conectar ao LifeGuard. Confira sua internet e tente novamente.';
    markServerOffline(message);
    throw new ApiError(message, undefined, 'CONNECTION_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return 'sem leitura';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 10) return 'agora';
  if (elapsedSeconds < 60) return `há ${elapsedSeconds} segundos`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
