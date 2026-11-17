import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, radii } from '../theme/theme';

export default function Card({ children, style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 20 },
});
