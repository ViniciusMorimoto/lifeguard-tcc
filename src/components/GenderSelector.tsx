import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Gender } from '../store/authStore';
import { colors, fonts, radii } from '../theme/theme';

export const genderOptions: Array<{ value: Gender; label: string }> = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'nao_binario', label: 'Não binário' },
  { value: 'outro', label: 'Outro' },
  { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
];

export function formatGender(value?: Gender | null) {
  return genderOptions.find((option) => option.value === value)?.label ?? 'Não informado';
}

type Props = {
  value: Gender | null;
  onChange: (value: Gender) => void;
  disabled?: boolean;
  required?: boolean;
};

export default function GenderSelector({ value, onChange, disabled = false, required = false }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Gênero {required ? <Text style={styles.required}>*</Text> : null}</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {genderOptions.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                disabled && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, marginBottom: 9 },
  required: { color: colors.ember },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 13, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg },
  optionSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
  optionTextSelected: { fontFamily: fonts.bodyBold, color: colors.sand },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
});
