import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { OpenSans_400Regular } from '@expo-google-fonts/open-sans';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/authStore';
import { apiRequest, ApiError } from './src/services/api';
import type { AuthUser } from './src/store/authStore';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import ConnectionBanner from './src/components/ConnectionBanner';
import { checkForAppUpdate } from './src/services/updates';
import PushRegistrationManager from './src/components/PushRegistrationManager';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 450, fade: true });

const STARTUP_TIMEOUT_MS = 4_000;

async function waitAtMost<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default function App() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    OpenSans_400Regular,
  });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const restorePromise = restoreSession().catch(() => undefined);

      await waitAtMost(restorePromise, STARTUP_TIMEOUT_MS);
      if (active) setBootstrapped(true);

      void restorePromise.then(() => {
        const session = useAuthStore.getState();
        if (!session.token) return;

        void apiRequest<{ usuario: AuthUser }>('/auth/me')
          .then(({ usuario }) => useAuthStore.getState().setUser(usuario))
          .catch((error) => {
            if (error instanceof ApiError && error.status === 401) {
              useAuthStore.getState().logout();
            }
          });
      });
    }

    void bootstrap();
    return () => { active = false; };
  }, [restoreSession]);

  useEffect(() => {
    const timeout = setTimeout(() => setFontWaitExpired(true), STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  const appReady = bootstrapped && (fontsLoaded || Boolean(fontError) || fontWaitExpired);

  useEffect(() => {
    if (appReady) void SplashScreen.hideAsync();
  }, [appReady]);

  useEffect(() => {
    if (!appReady) return;
    void checkForAppUpdate();
  }, [appReady]);

  if (!appReady) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <ConnectionBanner />
        <PushRegistrationManager />
        <AppErrorBoundary>
          <AppNavigator />
        </AppErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}
