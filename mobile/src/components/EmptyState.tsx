import type { ReactNode } from 'react';
import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import { Sparkle } from './Sparkle';

export function EmptyState({
  title,
  description,
  action,
  image,
  showIcon = true,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Ilustración que reemplaza a la estrella y a su recuadro punteado. */
  image?: ImageSourcePropType;
  /** Permite omitir solo la estrella decorativa; las ilustraciones se conservan. */
  showIcon?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[image ? styles.plain : styles.box, !image && !showIcon && styles.compact]}>
      {image ? (
        <Image source={image} style={styles.image} resizeMode="contain" accessible={false} />
      ) : showIcon ? (
        <View style={styles.icon}>
          <Sparkle size={24} color={colors.emptyStar} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  box: {
    alignItems: 'center',
    padding: 28,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.glass,
  },
  compact: { paddingVertical: 22 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  plain: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 56 },
  image: { width: 168, height: 168, marginBottom: 20 },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  action: { marginTop: 16 },
}));
