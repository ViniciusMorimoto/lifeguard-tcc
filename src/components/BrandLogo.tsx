import { Image, StyleSheet, View } from 'react-native';

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={compact ? styles.compact : styles.full}>
      <Image
        accessibilityLabel={compact ? 'LifeGuard' : 'LifeGuard. Monitoramento que protege.'}
        source={compact ? require('../../assets/brand/symbol.png') : require('../../assets/brand/logo-light.png')}
        resizeMode="contain"
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%', maxWidth: 360, height: 116 },
  compact: { width: 30, height: 34 },
  image: { width: '100%', height: '100%' },
});
