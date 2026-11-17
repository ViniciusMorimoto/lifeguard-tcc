import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/theme';
import { lifeGuardIconPaths, type LifeGuardIconName } from './lifeGuardIconPaths';

export default function LifeGuardIcon({ name, size = 28, color = colors.inkSoft }: {
  name: LifeGuardIconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {lifeGuardIconPaths[name].map((d, index) => <Path key={index} d={d} />)}
    </Svg>
  );
}
