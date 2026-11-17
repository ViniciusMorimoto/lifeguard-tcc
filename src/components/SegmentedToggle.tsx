import { View, Pressable, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';

type Option<T extends string> = { value: T; label: string };
type Props<T extends string> = { value: T; onChange: (value: T) => void; options: Option<T>[]; disabled?: boolean };

export default function SegmentedToggle<T extends string>({ value, onChange, options, disabled = false }: Props<T>) {
  return (
    <View accessibilityRole="tablist" style={styles.wrapper}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [styles.option, active && styles.optionActive, disabled && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', backgroundColor: colors.cardBg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: 18 },
  option: { flex: 1, minHeight: 46, paddingHorizontal: 8, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  optionActive: { backgroundColor: colors.ink },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  label: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  labelActive: { fontFamily: fonts.bodyBold, color: colors.sand },
});
