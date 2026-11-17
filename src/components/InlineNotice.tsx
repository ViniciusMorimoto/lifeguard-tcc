import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme/theme';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const config: Record<Tone, { bg: string; text: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  info: { bg: colors.coralSoft, text: colors.ink, icon: 'information-outline' },
  success: { bg: colors.mossBg, text: colors.mossText, icon: 'check-circle-outline' },
  warning: { bg: colors.amberBg, text: colors.amberText, icon: 'alert-outline' },
  danger: { bg: colors.emberBg, text: colors.emberText, icon: 'alert-circle-outline' },
};

export default function InlineNotice({ message, tone = 'info' }: { message: string; tone?: Tone }) {
  const item = config[tone];
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'} style={[styles.notice, { backgroundColor: item.bg }]}>
      <MaterialCommunityIcons accessible={false} name={item.icon} size={22} color={item.text} />
      <Text style={[styles.message, { color: item.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radii.md, padding: 14 },
  message: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
