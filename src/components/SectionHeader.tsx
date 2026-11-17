import { View, Text, StyleSheet } from 'react-native';
import AppButton from './AppButton';
import { colors, fonts } from '../theme/theme';

export default function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {actionLabel && onAction ? <AppButton label={actionLabel} variant="text" onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  action: { minHeight: 44, paddingHorizontal: 0 },
});
