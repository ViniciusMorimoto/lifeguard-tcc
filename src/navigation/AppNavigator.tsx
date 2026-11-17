import { useCallback, useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useNotificationResponse } from '../services/useNotificationResponse';
import type { RootStackParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import CadastroScreen from '../screens/CadastroScreen';
import RecuperarSenhaScreen from '../screens/RecuperarSenhaScreen';
import DocumentoLegalScreen from '../screens/DocumentoLegalScreen';
import PerfilScreen from '../screens/PerfilScreen';
import ContaSegurancaScreen from '../screens/ContaSegurancaScreen';
import AjudaSobreScreen from '../screens/AjudaSobreScreen';
import SemConexaoScreen from '../screens/SemConexaoScreen';
import HomeIdosoScreen from '../screens/idoso/HomeIdosoScreen';
import HomeCuidadorScreen from '../screens/cuidador/HomeCuidadorScreen';
import HistoricoScreen from '../screens/idoso/HistoricoScreen';
import HistoricoAlteracoesScreen from '../screens/HistoricoAlteracoesScreen';
import MeuDispositivoScreen from '../screens/idoso/MeuDispositivoScreen';
import CuidadoresScreen from '../screens/idoso/CuidadoresScreen';
import LimitesIdosoScreen from '../screens/idoso/LimitesIdosoScreen';
import ParearDispositivoScreen from '../screens/idoso/ParearDispositivoScreen';
import DetalheIdosoScreen from '../screens/cuidador/DetalheIdosoScreen';
import AlertasScreen from '../screens/cuidador/AlertasScreen';
import ConfigurarLimitesScreen from '../screens/cuidador/ConfigurarLimitesScreen';
import VincularIdosoScreen from '../screens/cuidador/VincularIdosoScreen';
import ContatoRapidoScreen from '../screens/cuidador/ContatoRapidoScreen';
import { colors } from '../theme/theme';
import { useAuthStore } from '../store/authStore';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function AppNavigator() {
  const user = useAuthStore((state) => state.user);
  const pendingResponse = useRef<Notifications.NotificationResponse | null>(null);
  const notificationResponse = useNotificationResponse();

  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    if (!navigationRef.isReady() || !user) {
      pendingResponse.current = response;
      return;
    }

    const data = response.notification.request.content.data;
    const type = typeof data.tipo === 'string' ? data.tipo : '';
    let handled = false;

    if (user.tipo === 'cuidador' && (type === 'alerta' || type === 'teste_alerta')) {
      navigationRef.navigate('Alertas');
      handled = true;
    } else if (user.tipo === 'idoso' && type === 'novo_vinculo') {
      navigationRef.navigate('Cuidadores');
      handled = true;
    } else if (user.tipo === 'idoso' && type === 'alerta') {
      navigationRef.navigate('HomeIdoso');
      handled = true;
    } else if (type === 'teste') {
      navigationRef.navigate('Perfil');
      handled = true;
    }

    if (handled) {
      pendingResponse.current = null;
      void Notifications.clearLastNotificationResponseAsync();
    }
  }, [user]);

  useEffect(() => {
    if (notificationResponse) handleNotificationResponse(notificationResponse);
  }, [handleNotificationResponse, notificationResponse]);

  const handleNavigationReady = useCallback(() => {
    const response = pendingResponse.current;
    if (response) handleNotificationResponse(response);
  }, [handleNotificationResponse]);

  useEffect(() => {
    if (!user && navigationRef.isReady() && navigationRef.getCurrentRoute()?.name !== 'Login') {
      navigationRef.resetRoot({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [user]);

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      <Stack.Navigator
        initialRouteName={user?.tipo === 'idoso' ? 'HomeIdoso' : user?.tipo === 'cuidador' ? 'HomeCuidador' : 'Login'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.sand },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Cadastro" component={CadastroScreen} />
        <Stack.Screen name="RecuperarSenha" component={RecuperarSenhaScreen} />
        <Stack.Screen name="DocumentoLegal" component={DocumentoLegalScreen} />
        <Stack.Screen name="HomeIdoso" component={HomeIdosoScreen} />
        <Stack.Screen name="HomeCuidador" component={HomeCuidadorScreen} />
        <Stack.Screen name="Perfil" component={PerfilScreen} />
        <Stack.Screen name="ContaSeguranca" component={ContaSegurancaScreen} />
        <Stack.Screen name="AjudaSobre" component={AjudaSobreScreen} />
        <Stack.Screen name="Historico" component={HistoricoScreen} />
        <Stack.Screen name="HistoricoAlteracoes" component={HistoricoAlteracoesScreen} />
        <Stack.Screen name="MeuDispositivo" component={MeuDispositivoScreen} />
        <Stack.Screen name="ParearDispositivo" component={ParearDispositivoScreen} />
        <Stack.Screen name="Cuidadores" component={CuidadoresScreen} />
        <Stack.Screen name="LimitesIdoso" component={LimitesIdosoScreen} />
        <Stack.Screen name="DetalheIdoso" component={DetalheIdosoScreen} />
        <Stack.Screen name="Alertas" component={AlertasScreen} />
        <Stack.Screen name="ConfigurarLimites" component={ConfigurarLimitesScreen} />
        <Stack.Screen name="VincularIdoso" component={VincularIdosoScreen} />
        <Stack.Screen name="ContatoRapido" component={ContatoRapidoScreen} />
        <Stack.Screen name="SemConexao" component={SemConexaoScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
