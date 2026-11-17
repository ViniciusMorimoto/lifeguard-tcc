import { Image, View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/theme';
import BrandLogo from './BrandLogo';

type Props = {
  title: string;
  subtitle: string;
  onProfile: () => void;
  onNotifications?: () => void;
  notificationCount?: number;
  photo?: string | null;
  accountType?: 'idoso' | 'cuidador';
};

export default function HomeHeader({ title, subtitle, onProfile, onNotifications, notificationCount = 0, photo, accountType }: Props) {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.brandRow}>
        <BrandLogo compact />
        <Text accessibilityRole="header" style={styles.brandLabel}>LIFEGUARD · {accountType === 'cuidador' ? 'REDE DE CUIDADO' : 'MEU CUIDADO'}</Text>
      </View>
      <View style={styles.wrapper}>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.actions}>
          {onNotifications ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Alertas${notificationCount ? `, ${notificationCount} novos` : ''}`} onPress={onNotifications} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <MaterialCommunityIcons accessible={false} name="bell-outline" size={24} color={colors.ink} />
              {notificationCount > 0 ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.badge}><Text allowFontScaling={false} style={styles.badgeText}>{notificationCount}</Text></View> : null}
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={onProfile} style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
            <View style={styles.profile}>
              {photo ? <Image accessible={false} source={{ uri: photo }} style={styles.profileImage} /> : <MaterialCommunityIcons accessible={false} name="account-outline" size={24} color={colors.sand} />}
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: { marginBottom: 26 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  signal: { width: 28, height: 8, flexDirection: 'row', alignItems: 'center' },
  signalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.coral },
  signalLine: { height: 2, flex: 1, backgroundColor: colors.coral },
  brandLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, color: colors.coral },
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 27, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.textSecondary, marginTop: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  action: { width: 48, height: 48, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  profileButton: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  profile: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  profileImage: { width: '100%', height: '100%' },
  badge: { position: 'absolute', right: 3, top: 3, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.ember, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.sand },
  badgeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
