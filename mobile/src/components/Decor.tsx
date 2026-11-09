import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Borde ondulado entre dos secciones: `from` es el color de arriba y `to` el de abajo.
 * Se estira a todo el ancho.
 */
export function Wave({ from, to, height = 36 }: { from: string; to: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: from }}>
      <Svg width="100%" height={height} viewBox="0 0 100 10" preserveAspectRatio="none">
        <Path fill={to} d="M0 10V6C12 0 24 0 36 5S62 11 76 5 94 1 100 4V10Z" />
      </Svg>
    </View>
  );
}

/**
 * Festón: fila de medios círculos del color `color` colgando hacia abajo (o hacia arriba con `up`).
 * Se pone justo debajo (o encima) de un bloque de ese mismo color.
 */
export function Scallops({
  color,
  count = 14,
  height = 14,
  up = false,
  style,
}: {
  color: string;
  count?: number;
  height?: number;
  up?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  let d = up ? 'M0 1' : 'M0 0';
  for (let i = 0; i < count; i++) d += up ? ` A1 1 0 0 1 ${2 * i + 2} 1` : ` A1 1 0 0 0 ${2 * i + 2} 0`;
  d += ' Z';
  return (
    <View style={[{ height }, style]} pointerEvents="none">
      <Svg width="100%" height={height} viewBox={`0 0 ${count * 2} 1`} preserveAspectRatio="none">
        <Path fill={color} d={d} />
      </Svg>
    </View>
  );
}

/** Línea punteada horizontal, como las de un boleto. */
export function Dashes({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', gap: 5, overflow: 'hidden' }, style]}>
      {Array.from({ length: 40 }, (_, i) => (
        <View key={i} style={{ width: 6, height: 1.5, borderRadius: 1, backgroundColor: color }} />
      ))}
    </View>
  );
}
