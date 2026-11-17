import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppButton from './AppButton';
import { colors, fonts } from '../theme/theme';

type Props = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrapper}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}><MaterialCommunityIcons name={icon} size={34} color={colors.coral} /></View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? <AppButton label={actionLabel} variant="secondary" onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  message: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  action: { marginTop: 22, alignSelf: 'stretch' },
});
