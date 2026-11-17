import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, StyleProp, TextInputProps, ViewStyle, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  rightIconLabel?: string;
  onRightIconPress?: () => void;
};

export default function AppTextInput({ label, style, error, helperText, required, containerStyle, rightIcon, rightIconLabel, onRightIconPress, onFocus, onBlur, editable = true, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <View style={[styles.inputShell, focused && styles.inputFocused, error && styles.inputError, !editable && styles.disabled]}>
        <TextInput
          accessibilityLabel={`${label}${required ? ', obrigatório' : ''}`}
          accessibilityHint={error ? `Erro: ${error}` : helperText}
          accessibilityState={{ disabled: !editable }}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.coral}
          editable={editable}
          style={[styles.input, rightIcon && styles.inputWithIcon, style]}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          {...rest}
        />
        {rightIcon && onRightIconPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rightIconLabel}
            disabled={!editable}
            hitSlop={8}
            onPress={onRightIconPress}
            style={({ pressed }) => [styles.rightIcon, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons accessible={false} name={rightIcon} size={23} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textPrimary, marginBottom: 7 },
  inputShell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.cardBg },
  input: { flex: 1, minHeight: 51, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 16, color: colors.textPrimary },
  inputWithIcon: { paddingRight: 4 },
  rightIcon: { width: 50, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  inputFocused: { borderColor: colors.ink },
  inputError: { borderColor: colors.ember },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.55 },
  helper: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.emberText, marginTop: 6 },
});
