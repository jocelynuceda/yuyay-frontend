import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';

/** Isotipo de Yuyay: corazón en dos tonos con su estrella. `color` lo vuelve de un solo color. */
export function Isotipo({
  size = 40,
  color,
  rightColor,
}: {
  size?: number;
  color?: string;
  /** Reemplaza el celeste en fondos donde se perdería. */
  rightColor?: string;
}) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="190 134 1514 1514">
      <Path fill={color ?? colors.ink} d="M965 1603C640 1375 400 1170 280 960C150 760 215 445 515 445C665 445 800 535 880 680C960 825 975 1000 975 1160C975 1230 970 1295 962 1355C850 1140 750 950 630 790C560 705 490 653 425 653C360 653 318 705 318 780C318 870 380 985 450 1070C590 1245 760 1390 928 1502L965 1603Z" />
      <Path fill={color ?? rightColor ?? colors.accent} d="M965 1603C1270 1375 1500 1170 1620 930C1660 850 1682 790 1682 725C1682 540 1550 428 1380 428C1235 428 1105 525 1030 655L940 840L1022 912C1120 755 1265 632 1380 632C1460 632 1518 690 1518 770C1518 870 1450 985 1370 1095C1260 1250 1100 1430 965 1603Z" />
      <Path fill={color ?? colors.primary} d="M965 180C986 290 1045 355 1162 377C1045 399 986 464 965 574C944 464 885 399 770 377C885 355 944 290 965 180Z" />
    </Svg>
  );
}
