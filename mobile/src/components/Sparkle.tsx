import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';

/** Estrella de 4 puntas, el motivo visual de Yuyay. */
export function Sparkle({ size = 24, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color ?? colors.primary}
        d="M12 1.5c.7 5.2 4 8.6 9.2 9.5-5.2.9-8.5 4.3-9.2 9.5C11.3 15.3 8 11.9 2.8 11 8 10.1 11.3 6.7 12 1.5Z"
      />
    </Svg>
  );
}
