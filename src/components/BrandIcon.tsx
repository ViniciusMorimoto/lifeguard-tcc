import { Image } from 'react-native';
import { colors } from '../theme/theme';

const artwork = {
  heart: require('../../assets/brand/elements/heart.png'),
  care: require('../../assets/brand/elements/care.png'),
  shield: require('../../assets/brand/elements/shield.png'),
  pulse: require('../../assets/brand/elements/pulse.png'),
};

export default function BrandIcon({ name, size = 28, color = colors.inkSoft }: {
  name: keyof typeof artwork;
  size?: number;
  color?: string;
}) {
  return <Image accessible={false} source={artwork[name]} resizeMode="contain"
    style={{ width: size, height: size, tintColor: color }} />;
}
