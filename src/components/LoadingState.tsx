import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';

export default function LoadingState({ message = 'Carregando informações...' }: { message?: string }) {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.coral} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 44, gap: 14 },
  message: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
});
