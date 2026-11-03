import Svg, { Ellipse, Path } from 'react-native-svg';
import { colors } from '../theme';

/** La estrella de Yuyay con carita: la mascota de las pantallas de bienvenida. */
export function SparkleBuddy({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={colors.cream}
        d="M12 1.5c.7 5.2 4 8.6 9.2 9.5-5.2.9-8.5 4.3-9.2 9.5C11.3 15.3 8 11.9 2.8 11 8 10.1 11.3 6.7 12 1.5Z"
      />
      <Ellipse cx={10.4} cy={10.5} rx={0.5} ry={0.62} fill={colors.ink} />
      <Ellipse cx={13.6} cy={10.5} rx={0.5} ry={0.62} fill={colors.ink} />
      <Ellipse cx={9.5} cy={11.7} rx={0.7} ry={0.4} fill={colors.accent} opacity={0.55} />
      <Ellipse cx={14.5} cy={11.7} rx={0.7} ry={0.4} fill={colors.accent} opacity={0.55} />
      <Path
        d="M11.1 11.85q.9.75 1.8 0"
        stroke={colors.ink}
        strokeWidth={0.38}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
