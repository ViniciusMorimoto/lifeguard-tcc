import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/theme';
import { passwordRequirements } from '../utils/validation';

export default function PasswordRequirements({ password }: { password: string }) {
  return (
    <View accessibilityLabel="Requisitos da senha" style={styles.wrapper}>
      <Text accessibilityRole="header" style={styles.title}>Sua senha deve ter:</Text>
      <View style={styles.grid}>
        {passwordRequirements.map((requirement) => {
          const met = requirement.test(password);
          return (
            <View accessible accessibilityLabel={`${requirement.label}: ${met ? 'atendido' : 'pendente'}`} key={requirement.key} style={styles.item}>
              <MaterialCommunityIcons
                accessible={false}
                name={met ? 'check-circle' : 'circle-outline'}
                size={17}
                color={met ? colors.moss : colors.textSecondary}
              />
              <Text style={[styles.label, met && styles.labelMet]}>{requirement.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: -7, marginBottom: 17, padding: 13, borderRadius: 14, backgroundColor: colors.inkMist, borderLeftWidth: 3, borderLeftColor: colors.coral },
  title: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, marginBottom: 8 },
  grid: { gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: colors.textSecondary },
  labelMet: { color: colors.mossText },
});
