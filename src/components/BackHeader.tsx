import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/theme';

type Props = {
  title: string;
  onBack: () => void;
  rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onRightPress?: () => void;
  rightLabel?: string;
};

export default function BackHeader({ title, onBack, rightIcon, onRightPress, rightLabel }: Props) {
  return (
    <View style={styles.wrapper}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={8} style={styles.actionBtn}>
        <MaterialCommunityIcons accessible={false} name="arrow-left" size={24} color={colors.ink} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {rightIcon && onRightPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={rightLabel ?? 'Ação'} onPress={onRightPress} hitSlop={8} style={styles.actionBtn}>
          <MaterialCommunityIcons accessible={false} name={rightIcon} size={24} color={colors.ink} />
        </Pressable>
      ) : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 },
  actionBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 21, color: colors.ink, textAlign: 'center', paddingHorizontal: 4 },
  spacer: { width: 48 },
});
