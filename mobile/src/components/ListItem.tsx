import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '../theme';

/** Fila de lista en tarjeta: ícono o iniciales, título, subtítulo y un elemento a la derecha. */
export function ListItem({
  title,
  subtitle,
  initials,
  icon,
  iconBg: iconBgProp,
  iconFg: iconFgProp,
  right,
  footer,
  onPress,
  dimmed,
}: {
  title: string;
  subtitle?: string | null;
  initials?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconFg?: string;
  right?: ReactNode;
  footer?: ReactNode;
  onPress?: () => void;
  dimmed?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const iconBg = iconBgProp ?? colors.soft;
  const iconFg = iconFgProp ?? colors.softText;
  const identity = (
    <>
      <View style={[styles.avatar, { backgroundColor: iconBg }]}>
        {initials ? (
          <Text style={[styles.initials, { color: iconFg }]}>{initials}</Text>
        ) : (
          <Ionicons name={icon ?? 'ellipse-outline'} size={20} color={iconFg} />
        )}
      </View>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </>
  );

  // `right` y `footer` quedan fuera del Pressable: pueden traer sus propios botones
  return (
    <View style={[styles.card, dimmed && styles.dimmed]}>
      <View style={styles.row}>
        {onPress ? (
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.identity, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            {identity}
            {right ? null : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
          </Pressable>
        ) : (
          <View style={styles.identity}>{identity}</View>
        )}
        {right}
      </View>
      {footer}
    </View>
  );
}

/** Botón redondo con ícono para acciones de una fila (quitar, compartir…). */
export function IconButton({
  icon,
  label,
  onPress,
  color: colorProp,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = colorProp ?? colors.muted;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  dimmed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.display, fontSize: 16 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
