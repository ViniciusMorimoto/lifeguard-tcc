import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import CadastroScreen from '../screens/CadastroScreen';
import HomeIdosoScreen from '../screens/idoso/HomeIdosoScreen';
import HomeCuidadorScreen from '../screens/cuidador/HomeCuidadorScreen';
import HistoricoScreen from '../screens/idoso/HistoricoScreen';
import MeuDispositivoScreen from '../screens/idoso/MeuDispositivoScreen';
import CuidadoresScreen from '../screens/idoso/CuidadoresScreen';
import DetalheIdosoScreen from '../screens/cuidador/DetalheIdosoScreen';
import AlertasScreen from '../screens/cuidador/AlertasScreen';
import ConfigurarLimitesScreen from '../screens/cuidador/ConfigurarLimitesScreen';
import VincularIdosoScreen from '../screens/cuidador/VincularIdosoScreen';
import ConexaoEsp32Screen from '../screens/ConexaoEsp32Screen.tsx';


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Cadastro" component={CadastroScreen} />
        <Stack.Screen name="HomeIdoso" component={HomeIdosoScreen} />
        <Stack.Screen name="HomeCuidador" component={HomeCuidadorScreen} />
        <Stack.Screen name="Historico" component={HistoricoScreen} />
        <Stack.Screen name="MeuDispositivo" component={MeuDispositivoScreen} />
        <Stack.Screen name="Cuidadores" component={CuidadoresScreen} />
        <Stack.Screen name="DetalheIdoso" component={DetalheIdosoScreen} />
        <Stack.Screen name="Alertas" component={AlertasScreen} />
        <Stack.Screen name="ConfigurarLimites" component={ConfigurarLimitesScreen} />
        <Stack.Screen name="VincularIdoso" component={VincularIdosoScreen} />
        <Stack.Screen name="ConexaoEsp32" component={ConexaoEsp32Screen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}