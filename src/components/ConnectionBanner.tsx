import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import { colors, fonts } from '../theme/theme';
import { useConnectionStore } from '../store/connectionStore';
import { checkApiConnection } from '../services/connectivity';

export default function ConnectionBanner() {
  const status = useConnectionStore((state) => state.status);
  const message = useConnectionStore((state) => state.message);
  const deviceProvisioning = useConnectionStore((state) => state.deviceProvisioning);
  const setOffline = useConnectionStore((state) => state.setOffline);
  const retryTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function handleNetworkState(state: Network.NetworkState) {
      if (state.isConnected === false || state.isInternetReachable === false) {
        setOffline();
        return;
      }
      void checkApiConnection();
    }

    void Network.getNetworkStateAsync().then(handleNetworkState).catch(() => void checkApiConnection());
    const subscription = Network.addNetworkStateListener(handleNetworkState);
    return () => subscription.remove();
  }, [setOffline]);

  useEffect(() => {
    if (status === 'offline' && !retryTimer.current) {
      retryTimer.current = setInterval(() => void checkApiConnection(), 15_000);
    } else if (status !== 'offline' && retryTimer.current) {
      clearInterval(retryTimer.current);
      retryTimer.current = null;
    }
    return () => {
      if (retryTimer.current) clearInterval(retryTimer.current);
      retryTimer.current = null;
    };
  }, [status]);

  if (status !== 'offline' || deviceProvisioning) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.banner}>
        <MaterialCommunityIcons accessible={false} name="wifi-off" size={18} color={colors.white} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.ember },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.ember },
  text: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: colors.white },
});
