import { Ionicons } from '@expo/vector-icons';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { categoryMeta, fallbackCategory } from '../utils/categories';

/** Círculo de una categoría de salud: su ilustración si la tiene; si no, el ícono sobre su color. */
export function CategoryIcon({ code, size, style }: { code: string; size: number; style: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const meta = categoryMeta[code] ?? fallbackCategory;

  if (meta.image) {
    return (
      <View style={style}>
        <Image source={meta.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>
    );
  }

  return (
    <View style={[style, { backgroundColor: colors[meta.bg] }]}>
      <Ionicons name={meta.icon} size={size} color={colors[meta.fg]} />
    </View>
  );
}
