export type RootStackParamList = {
  Login: undefined;
  Cadastro: undefined;
  HomeIdoso: undefined;
  HomeCuidador: undefined;
  Historico: { idosoId?: string; nome?: string } | undefined;
  MeuDispositivo: undefined;
  Cuidadores: undefined;
  DetalheIdoso: { idosoId: string; nome: string };
  Alertas: undefined;
  ConfigurarLimites: { idosoId: string; nome: string };
  VincularIdoso: undefined;
  ConexaoEsp32: undefined;
};