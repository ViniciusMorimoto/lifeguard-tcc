import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/theme';

type Props = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export default function OptionCheckbox({ checked, label, onChange, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.checkbox, checked && styles.checked]}>
        {checked ? <MaterialCommunityIcons accessible={false} name="check" size={18} color={colors.white} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, marginTop: -6, marginBottom: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.ink, borderColor: colors.ink },
  label: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.55 },
});
