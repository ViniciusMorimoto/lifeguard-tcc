import React, { useEffect, useRef } from 'react';
import { Animated, Image, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';

type Props = {
  variant?: 'divider' | 'background';
  animated?: boolean;
  style?: ViewStyle;
};

export default function PulseLine({ variant = 'divider', animated = false, style }: Props) {
  const opacity = useRef(new Animated.Value(variant === 'background' ? 0.12 : 1)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.22, duration: 1400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.08, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated]);

  const isDivider = variant === 'divider';
  const width = isDivider ? 220 : 260;
  const height = isDivider ? 26 : 56;

  return (
    <Animated.View style={[style, isDivider ? undefined : { opacity }]}>
      <Image accessible={false} source={require('../../assets/brand/elements/pulse.png')}
        resizeMode="contain" style={{ width, height, tintColor: colors.inkSoft }} />
    </Animated.View>
  );
}
