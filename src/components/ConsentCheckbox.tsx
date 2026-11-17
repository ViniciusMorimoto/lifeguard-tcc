import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/theme';

type Props = {
  checked: boolean;
  disabled?: boolean;
  error?: boolean;
  onChange: (checked: boolean) => void;
  onTermsPress: () => void;
  onPrivacyPress: () => void;
};

export default function ConsentCheckbox({ checked, disabled, error, onChange, onTermsPress, onPrivacyPress }: Props) {
  return (
    <View style={[styles.wrapper, error && styles.wrapperError, disabled && styles.disabled]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Concordo com os termos de uso e com a política de privacidade"
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        hitSlop={6}
        onPress={() => onChange(!checked)}
        style={({ pressed }) => [styles.checkbox, pressed && styles.pressed]}
      >
        <View style={[styles.checkboxBox, checked && styles.checkboxChecked]}>
          {checked ? <MaterialCommunityIcons accessible={false} name="check" size={19} color={colors.white} /> : null}
        </View>
      </Pressable>
      <Text style={styles.copy}>
        Li e concordo com os{' '}
        <Text accessibilityRole="link" onPress={disabled ? undefined : onTermsPress} style={styles.link}>Termos de Uso</Text>
        {' '}e com a{' '}
        <Text accessibilityRole="link" onPress={disabled ? undefined : onPrivacyPress} style={styles.link}>Política de Privacidade</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 18, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg },
  wrapperError: { borderColor: colors.ember, backgroundColor: colors.emberBg },
  checkbox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxBox: { width: 25, height: 25, borderRadius: 7, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  checkboxChecked: { borderColor: colors.ink, backgroundColor: colors.ink },
  copy: { flex: 1, flexShrink: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  link: { fontFamily: fonts.bodyBold, color: colors.coral, textDecorationLine: 'underline' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
});
