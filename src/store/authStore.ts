import { create } from 'zustand';
import { setApiToken, setUnauthorizedHandler } from '../services/api';
import * as SecureStore from 'expo-secure-store';
import { clearSecureCaches } from '../services/secureCache';

const SESSION_KEY = 'lifeguard.session.v1';

export type ElderProfile = {
  dataNascimento?: string | null;
  tipoSanguineo?: string | null;
  alergias?: string | null;
  medicamentos?: string | null;
  condicoesMedicas?: string | null;
  observacoesImportantes?: string | null;
  contatoEmergenciaNome?: string | null;
  contatoEmergenciaTelefone?: string | null;
};

export type Gender = 'feminino' | 'masculino' | 'nao_binario' | 'outro' | 'prefiro_nao_informar';

export type AuthUser = {
    id: string;
    nome: string;
    email: string;
    emailVerificado: boolean;
    telefone?: string | null;
    foto?: string | null;
    genero?: Gender | null;
    tipo: 'idoso' | 'cuidador';
    perfilIdoso?: ElderProfile | null;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  rememberSession: boolean;
  hydrated: boolean;
  restoreSession: () => Promise<void>;
  setSession: (token: string, user: NonNullable<AuthState['user']>, rememberSession?: boolean) => void;
  setUser: (user: AuthState['user']) => void;
  updateUser: (data: Partial<NonNullable<AuthState['user']>>) => void;
  logout: () => void;
};

async function persistSession(token: string, user: AuthUser) {
  const cachedUser = { ...user, foto: null };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ token, user: cachedUser }));
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  rememberSession: false,
  hydrated: false,
  restoreSession: async () => {
    try {
      const saved = await SecureStore.getItemAsync(SESSION_KEY);
      if (!saved) return;
      const session = JSON.parse(saved) as { token?: string; user?: AuthUser };
      if (!session.token || !session.user?.id || !session.user.tipo) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        return;
      }
      setApiToken(session.token);
      set({ token: session.token, user: session.user, rememberSession: true });
    } catch {
      await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
    } finally {
      set({ hydrated: true });
    }
  },
  setSession: (token, user, rememberSession = true) => {
    setApiToken(token);
    set({ token, user, rememberSession });
    if (rememberSession) void persistSession(token, user).catch(() => undefined);
    else void SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
  },
  setUser: (user) => {
    set({ user });
    const token = get().token;
    if (token && user && get().rememberSession) void persistSession(token, user).catch(() => undefined);
  },
  updateUser: (data) => {
    const current = get().user;
    const user = current ? { ...current, ...data } : null;
    set({ user });
    const token = get().token;
    if (token && user && get().rememberSession) void persistSession(token, user).catch(() => undefined);
  },
  logout: () => {
    const userId = get().user?.id;
    setApiToken(null);
    set({ user: null, token: null, rememberSession: false });
    void SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
    if (userId) void clearSecureCaches(userId);
  },
}));

setUnauthorizedHandler(() => useAuthStore.getState().logout());
